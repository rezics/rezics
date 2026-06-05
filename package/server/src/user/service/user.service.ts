/**
 * Never send unHashed passwords to server
 */

import type { UpdateUser } from "@rezics/contract";
import type { Language, UserSettings } from "@rezics/contract";
import { createSearchCommand, SEARCH_COMMAND_KINDS } from "@rezics/job";
import { randomUUID } from "node:crypto";
import { and, count, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { getDefaultRealmId } from "@/infra/default-realm";
import { requireSlugScopeId } from "@/infra/slug-scopes";
import { serverJobProducer } from "@/job/job-boundary";
import {
  bootstrapSystemShelves,
  createDrizzleSystemShelfClient,
} from "@/shelf/system-shelves";
import {
  EmailVerificationContract,
  RealmMember,
  Subscription,
  Unit,
  User,
} from "../../db/schema";
import type { UserFilterOptions, UserWithRelations } from "../models/types";

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
  preferredLanguages: Language[];
};

/**
 * Upsert the USER Unit that carries a user's canonical slug.
 *
 * Called whenever User.unitId becomes known. Idempotent: a re-call with the
 * same `(unitId, slug)` is a no-op.
 */
type UserRow = typeof User.$inferSelect;

export type UserRepository = {
  list(input: {
    q?: string;
    slug?: string;
    skip: number;
    take: number;
  }): Promise<{ users: UserWithRelations[]; total: number }>;
  getByUserId(userId: string): Promise<UserWithRelations>;
  getBySlug(slug: string): Promise<UserWithRelations | null>;
  create(input: CreateUserProfileInput): Promise<UserWithRelations>;
  materializeFromVerifiedAuth(
    input: CreateVerifiedAuthAccountInput,
  ): Promise<UserWithRelations>;
  completeProfileSetup(
    input: CompleteProfileSetupInput,
  ): Promise<UserWithRelations>;
  update(userId: string, data: Partial<UserRow>): Promise<UserWithRelations>;
  delete(userId: string): Promise<void>;
  exists(userId: string): Promise<boolean>;
  listFollowers(input: {
    userId: string;
    skip: number;
    take: number;
  }): Promise<{ users: UserWithRelations[]; total: number }>;
  listFollowings(input: {
    userId: string;
    skip: number;
    take: number;
  }): Promise<{ users: UserWithRelations[]; total: number }>;
  getCanonicalSlug(userId: string): Promise<string | null>;
};

async function getServerDb() {
  const { db } = await import("../../db/client");
  return db;
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

function createDrizzleUserRepository(): UserRepository {
  async function hydrateUsers(rows: UserRow[]): Promise<UserWithRelations[]> {
    if (rows.length === 0) return [];
    const db = await getServerDb();
    const userIds = rows.map((row) => row.unitId);
    const unitRows = await db
      .select()
      .from(Unit)
      .where(inArray(Unit.userId, userIds))
      .orderBy(desc(Unit.createdAt));
    const unitsByUser = new Map<string, (typeof Unit.$inferSelect)[]>();
    for (const unit of unitRows) {
      if (!unit.userId) continue;
      const list = unitsByUser.get(unit.userId) ?? [];
      if (list.length < 10) list.push(unit);
      unitsByUser.set(unit.userId, list);
    }
    const userUnits = await db
      .select({ id: Unit.id, slug: Unit.slug })
      .from(Unit)
      .where(inArray(Unit.id, userIds));
    const slugById = new Map(userUnits.map((unit) => [unit.id, unit.slug]));
    return rows.map((row) => ({
      ...row,
      units: unitsByUser.get(row.unitId) ?? [],
      slug: slugById.get(row.unitId) ?? null,
    }));
  }

  async function getUserOrThrow(userId: string): Promise<UserWithRelations> {
    const db = await getServerDb();
    const [row] = await db
      .select()
      .from(User)
      .where(eq(User.unitId, userId))
      .limit(1);
    if (!row) throw new Error("User not found");
    return (await hydrateUsers([row]))[0]!;
  }

  async function ensureUserUnit(
    database: any,
    unitId: string,
    slug: string | null,
  ) {
    const userScope = requireSlugScopeId("user");
    const now = new Date();
    await database
      .insert(Unit)
      .values({
        id: unitId,
        type: "USER",
        slug,
        slugScope: userScope,
        status: "PUBLISHED",
        visibility: "PUBLIC",
        isLanguageNeutral: true,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: Unit.id,
        set: { slug, slugScope: userScope, updatedAt: now },
      });
  }

  async function findUserByAuthId(database: any, authUserId: string) {
    const [row] = await database
      .select()
      .from(User)
      .where(eq(User.authUserId, authUserId))
      .limit(1);
    return row ?? null;
  }

  async function findUserById(database: any, userId: string) {
    const [row] = await database
      .select()
      .from(User)
      .where(eq(User.unitId, userId))
      .limit(1);
    return row ?? null;
  }

  return {
    async list(input) {
      const db = await getServerDb();
      const conditions = [];
      const userScope = requireSlugScopeId("user");
      if (input.q?.trim()) {
        const q = input.q.trim();
        const slugMatches = await db
          .select({ id: Unit.id })
          .from(Unit)
          .where(
            and(
              eq(Unit.type, "USER"),
              eq(Unit.slugScope, userScope),
              ilike(Unit.slug, `%${q}%`),
            ),
          );
        const slugMatchedIds = slugMatches.map((unit) => unit.id);
        conditions.push(
          or(
            ilike(User.name, `%${q}%`),
            ...(slugMatchedIds.length
              ? [inArray(User.unitId, slugMatchedIds)]
              : []),
          )!,
        );
      }
      if (input.slug?.trim()) {
        const [unit] = await db
          .select({ id: Unit.id })
          .from(Unit)
          .where(
            and(
              eq(Unit.slugScope, userScope),
              eq(Unit.slug, input.slug.trim()),
            ),
          )
          .limit(1);
        conditions.push(eq(User.unitId, unit?.id ?? "no-match"));
      }
      const where = conditions.length ? and(...conditions) : undefined;
      const [rows, totalRows] = await Promise.all([
        db
          .select()
          .from(User)
          .where(where)
          .orderBy(desc(User.createdAt))
          .offset(input.skip)
          .limit(input.take),
        db.select({ value: count() }).from(User).where(where),
      ]);
      return {
        users: await hydrateUsers(rows),
        total: totalRows[0]?.value ?? 0,
      };
    },
    getByUserId: getUserOrThrow,
    async getBySlug(slug) {
      const db = await getServerDb();
      const userScope = requireSlugScopeId("user");
      const [unit] = await db
        .select({ id: Unit.id, type: Unit.type })
        .from(Unit)
        .where(and(eq(Unit.slugScope, userScope), eq(Unit.slug, slug)))
        .limit(1);
      if (!unit || unit.type !== "USER") return null;
      const row = await findUserById(db, unit.id);
      return row ? (await hydrateUsers([row]))[0]! : null;
    },
    async create(input) {
      const db = await getServerDb();
      const row = await db.transaction(async (tx) => {
        await ensureUserUnit(tx, input.userId, input.slug);
        const now = new Date();
        const [created] = await tx
          .insert(User)
          .values({
            unitId: input.userId,
            name: input.slug,
            avatar: input.avatar ?? null,
            bio: input.bio ?? null,
            joinDate: now,
            updatedAt: now,
          })
          .returning();
        if (!created) throw new Error("Failed to create user");
        await bootstrapSystemShelves(
          input.userId,
          input.slug,
          createDrizzleSystemShelfClient(tx),
        );
        return created;
      });
      return (await hydrateUsers([row]))[0]!;
    },
    async materializeFromVerifiedAuth(input) {
      const db = await getServerDb();
      const row = await db.transaction(async (tx) => {
        const existing = await findUserByAuthId(tx, input.authUserId);
        if (existing) return existing;
        await ensureUserUnit(tx, input.authUserId, input.slug ?? null);
        const now = new Date();
        const [created] = await tx
          .insert(User)
          .values({
            unitId: input.authUserId,
            authUserId: input.authUserId,
            email: input.email,
            name: input.displayName ?? null,
            avatar: input.avatar ?? null,
            updatedAt: now,
          })
          .returning();
        if (!created) throw new Error("Failed to create user");
        await tx
          .insert(EmailVerificationContract)
          .values({
            id: randomUUID(),
            contractName: "user.email",
            ownerId: created.unitId,
            email: input.email,
            status: "VERIFIED",
            source: input.verificationSource,
            verifiedAt: input.verifiedAt ?? now,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: [
              EmailVerificationContract.contractName,
              EmailVerificationContract.ownerId,
              EmailVerificationContract.email,
            ],
            set: {
              status: "VERIFIED",
              source: input.verificationSource,
              verifiedAt: input.verifiedAt ?? now,
              updatedAt: now,
            },
          });
        return created;
      });
      return (await hydrateUsers([row]))[0]!;
    },
    async completeProfileSetup(input) {
      const db = await getServerDb();
      const displayName = input.displayName?.trim() || input.slug;
      const row = await db.transaction(async (tx) => {
        await ensureUserUnit(tx, input.userId, input.slug);
        const existing = await findUserById(tx, input.userId);
        const settings = {
          ...((existing?.settings as UserSettings | null) ?? {}),
          preferredLanguages: input.preferredLanguages,
        } satisfies UserSettings;
        const now = new Date();
        const [updated] = await tx
          .update(User)
          .set({
            name: displayName,
            avatar: input.avatar ?? undefined,
            joinDate: now,
            settings,
            updatedAt: now,
          })
          .where(eq(User.unitId, input.userId))
          .returning();
        if (!updated) throw new Error("User not found");
        await bootstrapSystemShelves(
          updated.unitId,
          input.slug,
          createDrizzleSystemShelfClient(tx),
        );
        const defaultRealmId = getDefaultRealmId();
        if (defaultRealmId) {
          await tx
            .insert(RealmMember)
            .values({
              realmUnitId: defaultRealmId,
              userId: updated.unitId,
              roleKey: "member",
              updatedAt: now,
            })
            .onConflictDoNothing();
        }
        return updated;
      });
      return (await hydrateUsers([row]))[0]!;
    },
    async update(userId, data) {
      const db = await getServerDb();
      const [row] = await db
        .update(User)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(User.unitId, userId))
        .returning();
      if (!row) throw new Error("User not found");
      return (await hydrateUsers([row]))[0]!;
    },
    async delete(userId) {
      const db = await getServerDb();
      await db.delete(User).where(eq(User.unitId, userId));
    },
    async exists(userId) {
      const db = await getServerDb();
      const [row] = await db
        .select({ value: count() })
        .from(User)
        .where(eq(User.unitId, userId));
      return (row?.value ?? 0) > 0;
    },
    async listFollowers({ userId, skip, take }) {
      const db = await getServerDb();
      const [subs, totalRows] = await Promise.all([
        db
          .select({
            subscriberUnitId: Subscription.subscriberUnitId,
            createdAt: Subscription.createdAt,
          })
          .from(Subscription)
          .innerJoin(Unit, eq(Subscription.subscriberUnitId, Unit.id))
          .where(
            and(
              eq(Subscription.subscribedUnitId, userId),
              eq(Unit.type, "USER"),
            ),
          )
          .orderBy(desc(Subscription.createdAt))
          .offset(skip)
          .limit(take),
        db
          .select({ value: count() })
          .from(Subscription)
          .innerJoin(Unit, eq(Subscription.subscriberUnitId, Unit.id))
          .where(
            and(
              eq(Subscription.subscribedUnitId, userId),
              eq(Unit.type, "USER"),
            ),
          ),
      ]);
      const orderById = new Map(subs.map((s, i) => [s.subscriberUnitId, i]));
      const rows = subs.length
        ? await db
            .select()
            .from(User)
            .where(
              inArray(
                User.unitId,
                subs.map((s) => s.subscriberUnitId),
              ),
            )
        : [];
      rows.sort(
        (a, b) =>
          (orderById.get(a.unitId) ?? 0) - (orderById.get(b.unitId) ?? 0),
      );
      return {
        users: await hydrateUsers(rows),
        total: totalRows[0]?.value ?? 0,
      };
    },
    async listFollowings({ userId, skip, take }) {
      const db = await getServerDb();
      const [subs, totalRows] = await Promise.all([
        db
          .select({
            subscribedUnitId: Subscription.subscribedUnitId,
            createdAt: Subscription.createdAt,
          })
          .from(Subscription)
          .innerJoin(Unit, eq(Subscription.subscribedUnitId, Unit.id))
          .where(
            and(
              eq(Subscription.subscriberUnitId, userId),
              eq(Unit.type, "USER"),
            ),
          )
          .orderBy(desc(Subscription.createdAt))
          .offset(skip)
          .limit(take),
        db
          .select({ value: count() })
          .from(Subscription)
          .innerJoin(Unit, eq(Subscription.subscribedUnitId, Unit.id))
          .where(
            and(
              eq(Subscription.subscriberUnitId, userId),
              eq(Unit.type, "USER"),
            ),
          ),
      ]);
      const orderById = new Map(subs.map((s, i) => [s.subscribedUnitId, i]));
      const rows = subs.length
        ? await db
            .select()
            .from(User)
            .where(
              inArray(
                User.unitId,
                subs.map((s) => s.subscribedUnitId),
              ),
            )
        : [];
      rows.sort(
        (a, b) =>
          (orderById.get(a.unitId) ?? 0) - (orderById.get(b.unitId) ?? 0),
      );
      return {
        users: await hydrateUsers(rows),
        total: totalRows[0]?.value ?? 0,
      };
    },
    async getCanonicalSlug(userId) {
      const db = await getServerDb();
      const [unit] = await db
        .select({ slug: Unit.slug })
        .from(Unit)
        .where(eq(Unit.id, userId))
        .limit(1);
      return unit?.slug ?? null;
    },
  };
}

/**
 * User Service - Business logic layer
 */
export class UserService {
  constructor(
    private readonly repository: UserRepository = createDrizzleUserRepository(),
  ) {}

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

    return this.repository.list({
      q: options.q,
      slug: options.slug,
      skip,
      take: limitNum,
    });
  }

  /**
   * Get user by unitId (formerly userId)
   */
  async getByUserId(userId: string): Promise<UserWithRelations> {
    return this.repository.getByUserId(userId);
  }

  /**
   * Get user by slug (USER scope on Unit)
   */
  async getBySlug(slug: string): Promise<UserWithRelations | null> {
    return this.repository.getBySlug(slug);
  }

  /**
   * Create new user
   */
  async create(req: CreateUserProfileInput): Promise<UserWithRelations> {
    const user = await this.repository.create(req);

    await enqueueUserSearch(SEARCH_COMMAND_KINDS.userSync, user.unitId);

    return user as UserWithRelations;
  }

  async materializeFromVerifiedAuth(
    payload: CreateVerifiedAuthAccountInput,
  ): Promise<UserWithRelations> {
    return this.repository.materializeFromVerifiedAuth(payload);
  }

  async completeProfileSetup(
    payload: CompleteProfileSetupInput,
  ): Promise<UserWithRelations> {
    const user = await this.repository.completeProfileSetup(payload);

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

    const updateData: Partial<UserRow> = {
      name: name ?? undefined,
      avatar: avatar !== undefined ? avatar : undefined,
      bio: bio !== undefined ? bio : undefined,
      description: description !== undefined ? description : undefined,
    };

    const user = await this.repository.update(userId, updateData);

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
    await this.repository.delete(userId);
    await enqueueUserSearch(SEARCH_COMMAND_KINDS.userDelete, userId);
  }

  /**
   * Check if user exists by unitId
   */
  async exists(userId: string): Promise<boolean> {
    return this.repository.exists(userId);
  }

  /**
   * List followers — users who have an active USER→USER `Subscription`
   * to `userId`.
   * Two-query pattern (subscription ids, then user rows) — `User` is
   * keyed by `unitId`, not by `Unit.userId`, so we cannot rely on
   * relation hydration to walk Unit→User for USER-type units.
   */
  async getFollowers(
    userId: string,
    options: { page?: number; limit?: number } = {},
  ): Promise<{ users: UserWithRelations[]; total: number }> {
    const pageNum = Math.max(Number(options.page ?? 1), 1);
    const limitNum = Math.max(1, Math.min(Number(options.limit ?? 20), 100));
    const skip = (pageNum - 1) * limitNum;

    return this.repository.listFollowers({ userId, skip, take: limitNum });
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

    return this.repository.listFollowings({ userId, skip, take: limitNum });
  }

  /**
   * Look up a user's canonical slug from the matching USER Unit. Returns
   * `null` when no Unit row exists for the user.
   */
  async getCanonicalSlug(userId: string): Promise<string | null> {
    return this.repository.getCanonicalSlug(userId);
  }
}

// Export singleton instance
export const userService = new UserService();
