/**
 * Never send unHashed passwords to server
 */

import { NotificationType, type UpdateUser } from "@rezics/contract";
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
import { emitNotificationEvent } from "../../notify/notify-client";
import type { UserFilterOptions, UserWithRelations } from "../models/types";
import { userInclude } from "../models/types";
import { syncProfileToAuth } from "./profile-sync";

export type CreateUserProfileInput = {
  unitId: string;
  slug: string;
  avatar?: string;
  bio?: string;
};

export type ProvisionFromJwtInput = {
  unitId: string;
  slug?: string;
  name?: string;
};

export type ProvisionFromAuthContextInput = {
  unitId: string;
  slug: string;
  name: string;
  avatar?: string | null;
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
   * Get user by unitId
   */
  async getByUnitId(unitId: string): Promise<UserWithRelations> {
    const user = await prisma.user.findUniqueOrThrow({
      where: { unitId },
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
    const { unitId, slug, avatar, bio } = req;

    const user = await prisma.user.create({
      data: {
        unitId,
        slug,
        name: slug,
        avatar: avatar ?? null,
        bio: bio ?? null,
        joinDate: new Date(),
      },
      include: userInclude,
    });

    await syncUserToMeili(user.unitId);

    return user as UserWithRelations;
  }

  async provisionFromJwt(
    payload: ProvisionFromJwtInput,
  ): Promise<UserWithRelations> {
    const slug = payload.slug?.trim() || payload.unitId;
    const name = payload.name?.trim() || slug;

    const user = await prisma.user.upsert({
      where: { unitId: payload.unitId },
      update: {},
      create: {
        unitId: payload.unitId,
        slug,
        name,
        joinDate: new Date(),
      },
      include: userInclude,
    });

    await syncUserToMeili(user.unitId);

    return user as UserWithRelations;
  }

  async provisionFromAuthContext(
    payload: ProvisionFromAuthContextInput,
  ): Promise<UserWithRelations> {
    const user = await prisma.user.upsert({
      where: { unitId: payload.unitId },
      update: {},
      create: {
        unitId: payload.unitId,
        slug: payload.slug,
        name: payload.name,
        avatar: payload.avatar ?? null,
        joinDate: new Date(),
      },
      include: userInclude,
    });

    await syncUserToMeili(user.unitId);

    return user as UserWithRelations;
  }

  /**
   * Update user
   */
  async update(unitId: string, req: UpdateUser): Promise<UserWithRelations> {
    const { name, avatar, bio, description } = req;

    const updateData: Prisma.UserUpdateInput = {
      name: name || undefined,
      avatar: avatar || undefined,
      bio: bio || undefined,
      description: description || undefined,
    };

    const user = await prisma.user.update({
      where: { unitId },
      data: updateData,
      include: userInclude,
    });

    // Partial sync user fields to Meilisearch
    const userPatchFields: Record<string, any> = {};
    if (name) userPatchFields.name = user.name;
    if (avatar) userPatchFields.avatar = user.avatar;
    if (bio) userPatchFields.bio = user.bio;
    if (description) userPatchFields.description = user.description;
    await patchUserFieldsToMeili(unitId, userPatchFields);

    // Fire-and-forget profile sync to auth
    syncProfileToAuth({
      unitId,
      name: user.name,
      slug: user.slug,
      avatar: user.avatar,
    }).catch(() => {});

    // Fire-and-forget: partial update denormalized author info on all posts
    const authorPatchFields: Record<string, any> = {};
    if (name) authorPatchFields.authorName = user.name;
    if (avatar) authorPatchFields.authorAvatar = user.avatar;
    patchPostsAuthorToMeili(unitId, authorPatchFields).catch(() => {});

    return user as UserWithRelations;
  }

  /**
   * Delete user by unitId
   */
  async delete(unitId: string): Promise<void> {
    await prisma.user.delete({ where: { unitId } });
    await deleteUserFromMeili(unitId);
  }

  /**
   * Check if user exists by unitId
   */
  async exists(unitId: string): Promise<boolean> {
    const count = await prisma.user.count({ where: { unitId } });
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
        where: { unitId: followerId },
        data: { followingsCount: { increment: 1 } },
      });

      await tx.user.update({
        where: { unitId: followingId },
        data: { followersCount: { increment: 1 } },
      });
    });

    // Emit notification (fire-and-forget)
    emitNotificationEvent({
      recipientId: followingId,
      type: NotificationType.FOLLOW,
      actorId: followerId,
      entityType: "user",
      entityId: followingId,
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
        where: { unitId: followerId },
        data: { followingsCount: { decrement: 1 } },
      });

      await tx.user.update({
        where: { unitId: followingId },
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
        unitId: { in: targetIds },
      },
      select: {
        unitId: true,
        followersCount: true,
      },
    });

    const result: Record<string, number> = {};
    // Initialize all requested ids to 0 for deterministic keys
    targetIds.forEach((id) => {
      result[id] = 0;
    });
    users.forEach((user) => {
      result[user.unitId] = user.followersCount ?? 0;
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
