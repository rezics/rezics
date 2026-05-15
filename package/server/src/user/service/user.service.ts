/**
 * Never send unHashed passwords to server
 */

import type { UpdateUser } from "@rezics/contract";
import type { Prisma } from "#/prisma/client";
import { prisma } from "#/prisma/client";
import {
  patchPostsAuthorToMeili,
  syncPostsByAuthorToMeili,
} from "@/meili/post/sync";
import {
  deleteUserFromMeili,
  patchUserFieldsToMeili,
  syncUserToMeili,
} from "@/meili/user/sync";
import { bootstrapSystemShelves } from "@/shelf/system-shelves";
import { broadcast } from "@/notify-boundary/notify-boundary.client";
import { getDefaultRealmId } from "@/infra/default-realm";
import { projectSlugToAuth } from "@/auth-boundary/auth-internal.client";
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

export type AdminSlugChangeResult = {
  user: UserWithRelations;
  authProjection: {
    attempted: boolean;
    ok: boolean;
  };
};

/**
 * User Service - Business logic layer
 */
export class UserService {
  /**
   * Build where clause for user queries
   */
  private buildWhereClause(options: UserFilterOptions): Prisma.UserWhereInput {
    const andWhere: Prisma.UserWhereInput[] = [];

    // Search in name or slug
    if (options.q?.trim()) {
      andWhere.push({
        OR: [
          { name: { contains: options.q, mode: "insensitive" } },
          { slug: { contains: options.q, mode: "insensitive" } },
        ],
      });
    }

    // Filter by slug
    if (options.slug?.trim()) {
      andWhere.push({ slug: { equals: options.slug, mode: "insensitive" } });
    }

    // UserType removed — no type filter

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

    const where = this.buildWhereClause(options);

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

    return { users: users as UserWithRelations[], total };
  }

  /**
   * Get user by userId
   */
  async getByUserId(userId: string): Promise<UserWithRelations> {
    const user = await prisma.user.findUniqueOrThrow({
      where: { userId },
      include: userInclude,
    });

    return user as UserWithRelations;
  }

  /**
   * Get user by slug
   */
  async getBySlug(slug: string): Promise<UserWithRelations | null> {
    const user = await prisma.user.findUnique({
      where: { slug },
      include: userInclude,
    });

    return user as UserWithRelations | null;
  }

  /**
   * Create new user
   */
  async create(req: CreateUserProfileInput): Promise<UserWithRelations> {
    const { userId, slug, avatar, bio } = req;

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          userId,
          slug,
          name: slug,
          avatar: avatar ?? null,
          bio: bio ?? null,
          joinDate: new Date(),
        },
        include: userInclude,
      });
      await bootstrapSystemShelves(userId, tx);
      return created;
    });

    await syncUserToMeili(user.userId);

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

      const created = await tx.user.create({
        data: {
          userId: payload.authUserId,
          authUserId: payload.authUserId,
          email: payload.email,
          slug: payload.slug ?? null,
          name: payload.displayName ?? null,
          avatar: payload.avatar ?? null,
        },
        include: userInclude,
      });
      await tx.emailVerificationContract.upsert({
        where: {
          contractName_ownerId_email: {
            contractName: "user.email",
            ownerId: created.userId,
            email: payload.email,
          },
        },
        create: {
          contractName: "user.email",
          ownerId: created.userId,
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
      const updated = await tx.user.update({
        where: { userId: payload.userId },
        data: {
          slug: payload.slug,
          name: displayName,
          avatar: payload.avatar ?? undefined,
          joinDate: new Date(),
        },
        include: userInclude,
      });

      await bootstrapSystemShelves(updated.userId, tx);

      const defaultRealmId = getDefaultRealmId();
      if (defaultRealmId) {
        await tx.realmMember
          .create({
            data: {
              realmUnitId: defaultRealmId,
              userId: updated.userId,
              roleKey: "member",
            },
          })
          .catch(() => {});
      }

      return updated;
    });

    await syncUserToMeili(user.userId);

    return user as UserWithRelations;
  }

  async changeCanonicalSlugAsAdmin(
    userId: string,
    slug: string,
  ): Promise<AdminSlugChangeResult> {
    const user = await prisma.user.update({
      where: { userId },
      data: { slug },
      include: userInclude,
    });

    await patchUserFieldsToMeili(userId, { slug: user.slug });
    patchPostsAuthorToMeili(userId, { authorSlug: user.slug }).catch(() => {});

    const authProjection = user.authUserId
      ? {
          attempted: true,
          ok: await projectSlugToAuth({
            authUserId: user.authUserId,
            slug,
          }),
        }
      : { attempted: false, ok: false };

    return {
      user: user as UserWithRelations,
      authProjection,
    };
  }

  /**
   * Update user
   */
  async update(userId: string, req: UpdateUser): Promise<UserWithRelations> {
    const { name, avatar, bio, description } = req;

    const updateData: Prisma.UserUpdateInput = {
      name: name || undefined,
      avatar: avatar || undefined,
      bio: bio || undefined,
      description: description || undefined,
    };

    const user = await prisma.user.update({
      where: { userId },
      data: updateData,
      include: userInclude,
    });

    // Partial sync user fields to Meilisearch
    const userPatchFields: Record<string, any> = {};
    if (name) userPatchFields.name = user.name;
    if (avatar) userPatchFields.avatar = user.avatar;
    if (bio) userPatchFields.bio = user.bio;
    if (description) userPatchFields.description = user.description;
    await patchUserFieldsToMeili(userId, userPatchFields);

    // Fire-and-forget: partial update denormalized author info on all posts
    const authorPatchFields: Record<string, any> = {};
    if (name) authorPatchFields.authorName = user.name;
    if (avatar) authorPatchFields.authorAvatar = user.avatar;
    patchPostsAuthorToMeili(userId, authorPatchFields).catch(() => {});

    return user as UserWithRelations;
  }

  /**
   * Delete user by userId
   */
  async delete(userId: string): Promise<void> {
    await prisma.user.delete({ where: { userId } });
    await deleteUserFromMeili(userId);
  }

  /**
   * Check if user exists by userId
   */
  async exists(userId: string): Promise<boolean> {
    const count = await prisma.user.count({ where: { userId } });
    return count > 0;
  }

  /**
   * Follow a user
   */
  async follow(followerId: string, followingId: string): Promise<void> {
    if (followerId === followingId) {
      throw new Error("Cannot follow yourself");
    }

    await prisma.$transaction(async (tx) => {
      const existing = await tx.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId,
            followingId,
          },
        },
      });

      if (existing) return;

      await tx.follow.create({
        data: {
          followerId,
          followingId,
        },
      });

      await tx.user.update({
        where: { userId: followerId },
        data: { followingsCount: { increment: 1 } },
      });

      await tx.user.update({
        where: { userId: followingId },
        data: { followersCount: { increment: 1 } },
      });
    });

    // Emit notification (fire-and-forget).
    // sourceUnitId here is the followed user's identity. Pre-L3 (user-namespace-slug)
    // this is the same value as the user PK; post-L3 it becomes the User's
    // Unit ID. Callers do not need to change at the cutover.
    broadcast({
      kind: "follow.new",
      sourceUnitId: followingId,
      directRecipients: [followingId],
      actorId: followerId,
    }).catch(() => {});
  }

  /**
   * Unfollow a user
   */
  async unfollow(followerId: string, followingId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId,
            followingId,
          },
        },
      });

      if (!existing) return;

      await tx.follow.delete({
        where: {
          followerId_followingId: {
            followerId,
            followingId,
          },
        },
      });

      await tx.user.update({
        where: { userId: followerId },
        data: { followingsCount: { decrement: 1 } },
      });

      await tx.user.update({
        where: { userId: followingId },
        data: { followersCount: { decrement: 1 } },
      });
    });
  }

  /**
   * Get follow status for multiple targets
   */
  async getFollowStatus(
    followerId: string,
    targetIds: string[],
  ): Promise<Record<string, boolean>> {
    if (!targetIds.length) return {};

    const follows = await prisma.follow.findMany({
      where: {
        followerId,
        followingId: { in: targetIds },
      },
      select: {
        followingId: true,
      },
    });

    const result: Record<string, boolean> = {};
    targetIds.forEach((id) => {
      result[id] = false;
    });
    follows.forEach((f) => {
      result[f.followingId] = true;
    });

    return result;
  }

  /**
   * Get follower counts summary for multiple targets.
   *
   * Returns a map: { [targetId]: followersCount }
   * Missing users default to 0.
   */
  async getFollowSummary(targetIds: string[]): Promise<Record<string, number>> {
    if (!targetIds.length) return {};

    const users = await prisma.user.findMany({
      where: {
        userId: { in: targetIds },
      },
      select: {
        userId: true,
        followersCount: true,
      },
    });

    const result: Record<string, number> = {};
    // Initialize all requested ids to 0 for deterministic keys
    targetIds.forEach((id) => {
      result[id] = 0;
    });
    users.forEach((user) => {
      result[user.userId] = user.followersCount ?? 0;
    });

    return result;
  }

  /**
   * List followers
   */
  async getFollowers(
    userId: string,
    options: { page?: number; limit?: number } = {},
  ): Promise<{ users: UserWithRelations[]; total: number }> {
    const pageNum = Math.max(Number(options.page ?? 1), 1);
    const limitNum = Math.max(1, Math.min(Number(options.limit ?? 20), 100));
    const skip = (pageNum - 1) * limitNum;

    const [follows, total] = await Promise.all([
      prisma.follow.findMany({
        where: { followingId: userId },
        include: { follower: { include: userInclude } },
        orderBy: { createdAt: "desc" },
        skip,
        take: limitNum,
      }),
      prisma.follow.count({ where: { followingId: userId } }),
    ]);

    return {
      users: follows.map((f) => f.follower as UserWithRelations),
      total,
    };
  }

  /**
   * List followings
   */
  async getFollowings(
    userId: string,
    options: { page?: number; limit?: number } = {},
  ): Promise<{ users: UserWithRelations[]; total: number }> {
    const pageNum = Math.max(Number(options.page ?? 1), 1);
    const limitNum = Math.max(1, Math.min(Number(options.limit ?? 20), 100));
    const skip = (pageNum - 1) * limitNum;

    const [follows, total] = await Promise.all([
      prisma.follow.findMany({
        where: { followerId: userId },
        include: { following: { include: userInclude } },
        orderBy: { createdAt: "desc" },
        skip,
        take: limitNum,
      }),
      prisma.follow.count({ where: { followerId: userId } }),
    ]);

    return {
      users: follows.map((f) => f.following as UserWithRelations),
      total,
    };
  }
}

// Export singleton instance
export const userService = new UserService();
