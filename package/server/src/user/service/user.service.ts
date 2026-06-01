/**
 * Never send unHashed passwords to server
 */

import type { UpdateUser } from "@rezics/contract";
import { createSearchCommand, SEARCH_COMMAND_KINDS } from "@rezics/job";
import { Prisma, prisma } from "#/prisma/client";
import { getDefaultRealmId } from "@/infra/default-realm";
import { requireSlugScopeId } from "@/infra/slug-scopes";
import { serverJobProducer } from "@/job/job-boundary";
import { bootstrapSystemShelves } from "@/shelf/system-shelves";
import type { UserFilterOptions, UserWithRelations } from "../models/types";
import { userInclude } from "../models/types";

export type CreateUserProfileInput = {
  userId: string;
  slug: string;
  avatar?: string;
  bio?: string;
};

export type CreateVerifiedAuthAccountInput = {
  authUserId: string;
  email: string;
  verificationSource: string;
  verifiedAt?: Date;
  displayName?: string;
  slug?: string;
  avatar?: string | null;
};

export type CompleteProfileSetupInput = {
  userId: string;
  slug: string;
  displayName?: string;
  avatar?: string | null;
};

/**
 * Upsert the USER Unit that carries a user's canonical slug.
 *
 * Called whenever User.unitId becomes known. Idempotent: a re-call with the
 * same `(unitId, slug)` is a no-op.
 */
async function ensureUserUnit(
  tx: Prisma.TransactionClient,
  unitId: string,
  slug: string | null,
): Promise<void> {
  const userScope = requireSlugScopeId("user");
  await tx.unit.upsert({
    where: { id: unitId },
    update: { slug, slugScope: userScope },
    create: {
      id: unitId,
      type: "USER",
      slug,
      slugScope: userScope,
      status: "PUBLISHED",
      visibility: "PUBLIC",
      isLanguageNeutral: true,
    },
  });
}

async function fetchUnitSlug(unitId: string): Promise<string | null> {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    select: { slug: true },
  });
  return unit?.slug ?? null;
}

async function batchUnitSlugs(
  unitIds: string[],
): Promise<Map<string, string | null>> {
  if (unitIds.length === 0) return new Map();
  const units = await prisma.unit.findMany({
    where: { id: { in: unitIds } },
    select: { id: true, slug: true },
  });
  return new Map(units.map((u) => [u.id, u.slug ?? null]));
}

async function attachSlug<T extends { unitId: string }>(
  user: T,
): Promise<T & { slug: string | null }> {
  const slug = await fetchUnitSlug(user.unitId);
  return { ...user, slug };
}

async function attachSlugs<T extends { unitId: string }>(
  users: T[],
): Promise<(T & { slug: string | null })[]> {
  const slugMap = await batchUnitSlugs(users.map((u) => u.unitId));
  return users.map((u) => ({ ...u, slug: slugMap.get(u.unitId) ?? null }));
}

function enqueueUserSearch(
  kind:
    | typeof SEARCH_COMMAND_KINDS.userSync
    | typeof SEARCH_COMMAND_KINDS.userDelete,
  userId: string,
) {
  return serverJobProducer.enqueue(
    createSearchCommand(kind, { userId }, { type: "server", service: "user" }),
  );
}

function enqueueUserPatchFields(
  userId: string,
  fields: Record<string, unknown>,
) {
  return serverJobProducer.enqueue(
    createSearchCommand(
      SEARCH_COMMAND_KINDS.userPatchFields,
      { targetId: userId, fields },
      { type: "server", service: "user" },
    ),
  );
}

function enqueueUserPostsAuthorFanout(userId: string) {
  return serverJobProducer.enqueue(
    createSearchCommand(
      SEARCH_COMMAND_KINDS.userPostsAuthorFanout,
      { targetId: userId },
      { type: "server", service: "user" },
    ),
  );
}

/**
 * User Service - Business logic layer
 */
export class UserService {
  /**
   * Build where clause for user queries. Slug filters are translated to a
   * USER Unit match because the slug column lives on Unit now.
   */
  private async buildWhereClause(
    options: UserFilterOptions,
  ): Promise<Prisma.UserWhereInput> {
    const andWhere: Prisma.UserWhereInput[] = [];
    const userScope = requireSlugScopeId("user");

    if (options.q?.trim()) {
      const q = options.q.trim();
      const slugMatches = await prisma.unit.findMany({
        where: {
          type: "USER",
          slugScope: userScope,
          slug: { contains: q, mode: "insensitive" },
        },
        select: { id: true },
      });
      const slugMatchedIds = slugMatches.map((u) => u.id);
      andWhere.push({
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          ...(slugMatchedIds.length > 0
            ? [{ unitId: { in: slugMatchedIds } }]
            : []),
        ],
      });
    }

    if (options.slug?.trim()) {
      const slugMatch = await prisma.unit.findUnique({
        where: { slugScope_slug: { slugScope: userScope, slug: options.slug } },
        select: { id: true },
      });
      andWhere.push({ unitId: slugMatch?.id ?? "no-match" });
    }

    return andWhere.length > 0 ? { AND: andWhere } : {};
  }

  /**
   * List users with filters and pagination
   */
  async list(options: UserFilterOptions = {}): Promise<{
    users: UserWithRelations[];
    total: number;
  }> {
    const pageNum = Math.max(Number(options.page ?? 1), 1);
    const limitNum = Math.max(1, Math.min(Number(options.limit ?? 20), 100));
    const skip = (pageNum - 1) * limitNum;

    const where = await this.buildWhereClause(options);

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limitNum,
        include: userInclude,
      }),
      prisma.user.count({ where }),
    ]);

    const withSlugs = await attachSlugs(users);
    return { users: withSlugs as UserWithRelations[], total };
  }

  /**
   * Get user by unitId (formerly userId)
   */
  async getByUserId(userId: string): Promise<UserWithRelations> {
    const user = await prisma.user.findUniqueOrThrow({
      where: { unitId: userId },
      include: userInclude,
    });

    return (await attachSlug(user)) as UserWithRelations;
  }

  /**
   * Get user by slug (USER scope on Unit)
   */
  async getBySlug(slug: string): Promise<UserWithRelations | null> {
    const userScope = requireSlugScopeId("user");
    const unit = await prisma.unit.findUnique({
      where: { slugScope_slug: { slugScope: userScope, slug } },
      select: { id: true, type: true },
    });
    if (!unit || unit.type !== "USER") return null;

    const user = await prisma.user.findUnique({
      where: { unitId: unit.id },
      include: userInclude,
    });

    if (!user) return null;
    return {
      ...user,
      slug: unit.type === "USER" ? slug : null,
    } as UserWithRelations;
  }

  /**
   * Create new user
   */
  async create(req: CreateUserProfileInput): Promise<UserWithRelations> {
    const { userId, slug, avatar, bio } = req;

    const user = await prisma.$transaction(async (tx) => {
      await ensureUserUnit(tx, userId, slug);
      const created = await tx.user.create({
        data: {
          unitId: userId,
          name: slug,
          avatar: avatar ?? null,
          bio: bio ?? null,
          joinDate: new Date(),
        },
        include: userInclude,
      });
      await bootstrapSystemShelves(userId, slug, tx);
      return created;
    });

    await enqueueUserSearch(SEARCH_COMMAND_KINDS.userSync, user.unitId);

    await enqueueUserSearch(SEARCH_COMMAND_KINDS.userSync, user.unitId);

    return user as UserWithRelations;
  }

  async materializeFromVerifiedAuth(
    payload: CreateVerifiedAuthAccountInput,
  ): Promise<UserWithRelations> {
    const user = await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({
        where: { authUserId: payload.authUserId },
        include: userInclude,
      });
      if (existing) return existing;

      await ensureUserUnit(tx, payload.authUserId, payload.slug ?? null);
      const created = await tx.user.create({
        data: {
          unitId: payload.authUserId,
          authUserId: payload.authUserId,
          email: payload.email,
          name: payload.displayName ?? null,
          avatar: payload.avatar ?? null,
        },
        include: userInclude,
      });
      await tx.emailVerificationContract.upsert({
        where: {
          contractName_ownerId_email: {
            contractName: "user.email",
            ownerId: created.unitId,
            email: payload.email,
          },
        },
        create: {
          contractName: "user.email",
          ownerId: created.unitId,
          email: payload.email,
          status: "VERIFIED",
          source: payload.verificationSource,
          verifiedAt: payload.verifiedAt ?? new Date(),
        },
        update: {
          status: "VERIFIED",
          source: payload.verificationSource,
          verifiedAt: payload.verifiedAt ?? new Date(),
        },
      });
      return created;
    });

    return user as UserWithRelations;
  }

  async completeProfileSetup(
    payload: CompleteProfileSetupInput,
  ): Promise<UserWithRelations> {
    const displayName = payload.displayName?.trim() || payload.slug;

    const user = await prisma.$transaction(async (tx) => {
      await ensureUserUnit(tx, payload.userId, payload.slug);
      const updated = await tx.user.update({
        where: { unitId: payload.userId },
        data: {
          name: displayName,
          avatar: payload.avatar ?? undefined,
          joinDate: new Date(),
        },
        include: userInclude,
      });

      await bootstrapSystemShelves(updated.unitId, payload.slug, tx);

      const defaultRealmId = getDefaultRealmId();
      if (defaultRealmId) {
        await tx.realmMember
          .create({
            data: {
              realmUnitId: defaultRealmId,
              userId: updated.unitId,
              roleKey: "member",
            },
          })
          .catch(() => {});
      }

      return updated;
    });

    await enqueueUserSearch(SEARCH_COMMAND_KINDS.userSync, user.unitId);

    return user as UserWithRelations;
  }

  /**
   * Update user. User slugs are immutable — any caller that smuggles a
   * `slug` field is rejected with `USER_SLUG_IMMUTABLE`.
   */
  async update(userId: string, req: UpdateUser): Promise<UserWithRelations> {
    if ((req as Record<string, unknown>).slug !== undefined) {
      const err = new Error("User slug is immutable.") as Error & {
        code?: string;
      };
      err.code = "USER_SLUG_IMMUTABLE";
      throw err;
    }

    const { name, avatar, bio, description } = req;

    const updateData: Prisma.UserUpdateInput = {
      name: name ?? undefined,
      avatar: avatar !== undefined ? avatar : undefined,
      bio: bio !== undefined ? bio : undefined,
      description:
        description !== undefined
          ? description === null
            ? Prisma.JsonNull
            : (description as Prisma.InputJsonValue)
          : undefined,
    };

    const user = (await attachSlug(
      await prisma.user.update({
        where: { unitId: userId },
        data: updateData,
        include: userInclude,
      }),
    )) as UserWithRelations;

    const userPatchFields: Record<string, any> = {};
    if (name !== undefined) userPatchFields.name = user.name;
    if (avatar !== undefined) userPatchFields.avatar = user.avatar;
    if (bio !== undefined) userPatchFields.bio = user.bio;
    if (description !== undefined)
      userPatchFields.description = user.description;
    const jobs = [enqueueUserPatchFields(userId, userPatchFields)];
    if (name !== undefined || avatar !== undefined) {
      jobs.push(enqueueUserPostsAuthorFanout(userId));
    }
    await Promise.all(jobs);

    return user as UserWithRelations;
  }

  /**
   * Delete user by unitId
   */
  async delete(userId: string): Promise<void> {
    await prisma.user.delete({ where: { unitId: userId } });
    await enqueueUserSearch(SEARCH_COMMAND_KINDS.userDelete, userId);
  }

  /**
   * Check if user exists by unitId
   */
  async exists(userId: string): Promise<boolean> {
    const count = await prisma.user.count({ where: { unitId: userId } });
    return count > 0;
  }

  /**
   * List followers — users who have an active USER→USER `Subscription`
   * to `userId`.
   * Two-query pattern (subscription ids, then user rows) — `User` is
   * keyed by `unitId`, not by `Unit.userId`, so we cannot rely on
   * Prisma's relation include to walk Unit→User for USER-type units.
   */
  async getFollowers(
    userId: string,
    options: { page?: number; limit?: number } = {},
  ): Promise<{ users: UserWithRelations[]; total: number }> {
    const pageNum = Math.max(Number(options.page ?? 1), 1);
    const limitNum = Math.max(1, Math.min(Number(options.limit ?? 20), 100));
    const skip = (pageNum - 1) * limitNum;

    const where = {
      subscribedUnitId: userId,
      subscriber: { type: "USER" as const },
    } satisfies Prisma.SubscriptionWhereInput;

    const [subs, total] = await Promise.all([
      prisma.subscription.findMany({
        where,
        select: { subscriberUnitId: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        skip,
        take: limitNum,
      }),
      prisma.subscription.count({ where }),
    ]);

    const orderById = new Map(subs.map((s, i) => [s.subscriberUnitId, i]));
    const followers = await prisma.user.findMany({
      where: { unitId: { in: subs.map((s) => s.subscriberUnitId) } },
      include: userInclude,
    });
    followers.sort(
      (a, b) => (orderById.get(a.unitId) ?? 0) - (orderById.get(b.unitId) ?? 0),
    );
    const users = await attachSlugs(followers);
    return { users: users as UserWithRelations[], total };
  }

  /**
   * List followings — users that `userId` has an active USER→USER
   * `Subscription` to.
   */
  async getFollowings(
    userId: string,
    options: { page?: number; limit?: number } = {},
  ): Promise<{ users: UserWithRelations[]; total: number }> {
    const pageNum = Math.max(Number(options.page ?? 1), 1);
    const limitNum = Math.max(1, Math.min(Number(options.limit ?? 20), 100));
    const skip = (pageNum - 1) * limitNum;

    const where = {
      subscriberUnitId: userId,
      subscribedUnit: { type: "USER" as const },
    } satisfies Prisma.SubscriptionWhereInput;

    const [subs, total] = await Promise.all([
      prisma.subscription.findMany({
        where,
        select: { subscribedUnitId: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        skip,
        take: limitNum,
      }),
      prisma.subscription.count({ where }),
    ]);

    const orderById = new Map(subs.map((s, i) => [s.subscribedUnitId, i]));
    const followings = await prisma.user.findMany({
      where: { unitId: { in: subs.map((s) => s.subscribedUnitId) } },
      include: userInclude,
    });
    followings.sort(
      (a, b) => (orderById.get(a.unitId) ?? 0) - (orderById.get(b.unitId) ?? 0),
    );
    const users = await attachSlugs(followings);
    return { users: users as UserWithRelations[], total };
  }

  /**
   * Look up a user's canonical slug from the matching USER Unit. Returns
   * `null` when no Unit row exists for the user.
   */
  async getCanonicalSlug(userId: string): Promise<string | null> {
    return fetchUnitSlug(userId);
  }
}

// Export singleton instance
export const userService = new UserService();
