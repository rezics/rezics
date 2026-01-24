/**
 * Never send unHashed passwords to server
 */
import {prisma} from '@/prisma/client';
import {UserType} from '@/prisma/client';
import type {Prisma} from '@/prisma/client';
import type {UserFilterOptions, UserWithRelations} from './types';
import {userInclude} from './types';
import type {CreateUserFull, UpdateUser} from '@package/contract';
import {hashPassword, verifyPassword} from './utils';
import nodemailer from 'nodemailer';
import {syncUserToMeili, deleteUserFromMeili} from '@/src/meili/user/sync';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
  pool: true,
  maxConnections: 3,
  maxMessages: 50,
  tls: {
    rejectUnauthorized: true,
  },
});

const SALT_ROUNDS = 10;

/**
 * User Service - Business logic layer
 */
export class UserService {
  /**
   * Build where clause for user queries
   */
  private buildWhereClause(options: UserFilterOptions): Prisma.UserWhereInput {
    const andWhere: Prisma.UserWhereInput[] = [];

    // Search in name, email, or slug
    if (options.q && options.q.trim()) {
      andWhere.push({
        OR: [
          {name: {contains: options.q, mode: 'insensitive'}},
          {email: {contains: options.q, mode: 'insensitive'}},
          {slug: {contains: options.q, mode: 'insensitive'}},
        ],
      });
    }

    // Filter by email
    if (options.email && options.email.trim()) {
      andWhere.push({email: {equals: options.email, mode: 'insensitive'}});
    }

    // Filter by slug
    if (options.slug && options.slug.trim()) {
      andWhere.push({slug: {equals: options.slug, mode: 'insensitive'}});
    }

    // Filter by type
    if (options.type) {
      andWhere.push({type: options.type as UserType});
    }

    return andWhere.length > 0 ? {AND: andWhere} : {};
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
        orderBy: {createdAt: 'desc'},
        skip,
        take: limitNum,
        include: userInclude,
      }),
      prisma.user.count({where}),
    ]);

    return {users: users as UserWithRelations[], total};
  }

  /**
   * Get user by unitId
   */
  async getByUnitId(unitId: string): Promise<UserWithRelations> {
    const user = await prisma.user.findUniqueOrThrow({
      where: {unitId},
      include: userInclude,
    });

    return user as UserWithRelations;
  }

  /**
   * Get user by email
   */
  async getByEmail(email: string): Promise<UserWithRelations | null> {
    const user = await prisma.user.findUnique({
      where: {email},
      include: userInclude,
    });

    return user as UserWithRelations | null;
  }

  /**
   * Get user by slug
   */
  async getBySlug(slug: string): Promise<UserWithRelations | null> {
    const user = await prisma.user.findUnique({
      where: {slug},
      include: userInclude,
    });

    return user as UserWithRelations | null;
  }

  /**
   * Create new user
   */
  async create(req: CreateUserFull): Promise<UserWithRelations> {
    const {email, password, slug, avatar, bio} = req;

    const user = await prisma.user.create({
      data: {
        email,
        slug,
        passwordHash: password,
        name: slug,
        avatar: avatar || undefined,
        bio: bio || undefined,
        type: UserType.USER,
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
    const {name, avatar, bio, password} = req;

    const updateData: Prisma.UserUpdateInput = {
      name: name || undefined,
      avatar: avatar || undefined,
      bio: bio || undefined,
    };

    // Update password if provided
    if (password) {
      updateData.passwordHash = password;
    }

    const user = await prisma.user.update({
      where: {unitId},
      data: updateData,
      include: userInclude,
    });

    await syncUserToMeili(unitId);

    return user as UserWithRelations;
  }

  /**
   * Delete user by unitId
   */
  async delete(unitId: string): Promise<void> {
    await prisma.user.delete({where: {unitId}});
    await deleteUserFromMeili(unitId);
  }

  /**
   * Check if user exists by unitId
   */
  async exists(unitId: string): Promise<boolean> {
    const count = await prisma.user.count({where: {unitId}});
    return count > 0;
  }

  /**
   * Verify user password
   */
  async verifyPassword(email: string, password: string): Promise<boolean> {
    const user = await this.getByEmail(email);
    if (!user) {
      return false;
    }

    return verifyPassword(password, user.passwordHash);
  }

  /**
   * Authenticate user and return user data
   */
  async authenticate(
    email: string,
    password: string,
  ): Promise<UserWithRelations | null> {
    const user = await this.getByEmail(email);
    if (!user) {
      return null;
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return null;
    }

    return user;
  }

  async resetPassword(
    email: string,
    verificationCode: string,
    newPassword: string,
  ): Promise<void> {
    const verificationCodeRecord = await prisma.verificationCode.findUnique({
      where: {email, code: verificationCode},
    });
    if (!verificationCodeRecord) {
      throw new Error('Verification code not found');
    }
    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: {email},
      data: {passwordHash},
    });
  }

  // ANCHOR Verification Code Logic
  /**
   * Send verification code
   */
  async sendVerificationCode(
    email: string,
    userId?: string,
  ): Promise<{status: 'success' | 'error'; data: any}> {
    const nowTime = new Date();
    const isEmailExist = await prisma.verificationCode.findUnique({
      where: {email},
    });
    const minResendTime = 1000 * 30; // 30 seconds
    if (isEmailExist) {
      const elapsed = nowTime.getTime() - isEmailExist.createdAt.getTime();
      if (elapsed < minResendTime) {
        return {
          status: 'error',
          data: `You can only resend the code after ${
            minResendTime / 1000
          } seconds`,
        };
      }
    }
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(nowTime.getTime() + 1000 * 60 * 30); // 30 minutes
    const theUserId = userId ?? '019aca29-e86c-79ba-a29e-cd6b1c653c55'; // we don't need user id for verification code
    transporter.sendMail({
      from: `${process.env.SMTP_USER_NAME} <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'REZICS - Verification Code',
      text: `Your verification code is: ${code}. It will expire in 30 minutes.`,
      html: `<strong>Your verification code is: ${code}. It will expire in 30 minutes.</strong>`,
    });

    await prisma.verificationCode.upsert({
      where: {email},
      update: {code, expiresAt, createdAt: nowTime, usedAt: null},
      create: {email, userId: theUserId, code, expiresAt, usedAt: null},
    });

    return {status: 'success', data: 'Verification code sent successfully'};
  }

  /**
   * Verify verification code
   */
  async verifyVerificationCode(
    email: string,
    code: string,
  ): Promise<{status: 'success' | 'error'; message?: string}> {
    const verificationCode = await prisma.verificationCode.findUnique({
      where: {email, code},
    });
    if (!verificationCode) {
      return {status: 'error', message: 'Verification code not found'};
    }
    if (verificationCode.expiresAt < new Date()) {
      return {status: 'error', message: 'Verification code expired'};
    }
    if (verificationCode.usedAt) {
      return {status: 'error', message: 'Verification code already used'};
    }
    await prisma.verificationCode.update({
      where: {id: verificationCode.id},
      data: {usedAt: new Date()},
    });
    return {status: 'success'};
  }
  /**
   * Resend verification code
   */
  async resendVerificationCode(email: string, userId: string): Promise<void> {
    await this.sendVerificationCode(email, userId);
  }

  /**
   * Follow a user
   */
  async follow(followerId: string, followingId: string): Promise<void> {
    if (followerId === followingId) {
      throw new Error('Cannot follow yourself');
    }

    await prisma.$transaction(async tx => {
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
        where: {unitId: followerId},
        data: {followingsCount: {increment: 1}},
      });

      await tx.user.update({
        where: {unitId: followingId},
        data: {followersCount: {increment: 1}},
      });
    });
  }

  /**
   * Unfollow a user
   */
  async unfollow(followerId: string, followingId: string): Promise<void> {
    await prisma.$transaction(async tx => {
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
        where: {unitId: followerId},
        data: {followingsCount: {decrement: 1}},
      });

      await tx.user.update({
        where: {unitId: followingId},
        data: {followersCount: {decrement: 1}},
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
        followingId: {in: targetIds},
      },
      select: {
        followingId: true,
      },
    });

    const result: Record<string, boolean> = {};
    targetIds.forEach(id => {
      result[id] = false;
    });
    follows.forEach(f => {
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
        unitId: {in: targetIds},
      },
      select: {
        unitId: true,
        followersCount: true,
      },
    });

    const result: Record<string, number> = {};
    // Initialize all requested ids to 0 for deterministic keys
    targetIds.forEach(id => {
      result[id] = 0;
    });
    users.forEach(user => {
      result[user.unitId] = user.followersCount ?? 0;
    });

    return result;
  }

  /**
   * List followers
   */
  async getFollowers(
    userId: string,
    options: {page?: number; limit?: number} = {},
  ): Promise<{users: UserWithRelations[]; total: number}> {
    const pageNum = Math.max(Number(options.page ?? 1), 1);
    const limitNum = Math.max(1, Math.min(Number(options.limit ?? 20), 100));
    const skip = (pageNum - 1) * limitNum;

    const [follows, total] = await Promise.all([
      prisma.follow.findMany({
        where: {followingId: userId},
        include: {follower: {include: userInclude}},
        orderBy: {createdAt: 'desc'},
        skip,
        take: limitNum,
      }),
      prisma.follow.count({where: {followingId: userId}}),
    ]);

    return {
      users: follows.map(f => f.follower as UserWithRelations),
      total,
    };
  }

  /**
   * List followings
   */
  async getFollowings(
    userId: string,
    options: {page?: number; limit?: number} = {},
  ): Promise<{users: UserWithRelations[]; total: number}> {
    const pageNum = Math.max(Number(options.page ?? 1), 1);
    const limitNum = Math.max(1, Math.min(Number(options.limit ?? 20), 100));
    const skip = (pageNum - 1) * limitNum;

    const [follows, total] = await Promise.all([
      prisma.follow.findMany({
        where: {followerId: userId},
        include: {following: {include: userInclude}},
        orderBy: {createdAt: 'desc'},
        skip,
        take: limitNum,
      }),
      prisma.follow.count({where: {followerId: userId}}),
    ]);

    return {
      users: follows.map(f => f.following as UserWithRelations),
      total,
    };
  }
}

// Export singleton instance
export const userService = new UserService();
