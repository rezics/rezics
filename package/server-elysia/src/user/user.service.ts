/**
 * Never send unHashed passwords to server
 */
import {prisma} from '@/prisma/client';
import {UserType} from '@/prisma/client';
import type {Prisma} from '@/prisma/client';
import type {UserFilterOptions, UserWithRelations} from './types';
import {userInclude} from './types';
import type {CreateUserInput, UpdateUserInput} from '@package/contract';
import {isPasswordValid} from './utils';

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
  async create(req: CreateUserInput): Promise<UserWithRelations> {
    const {email, password, slug, avatar, bio} = req;

    // Check if email already exists
    const existing = await this.getByEmail(email);
    if (existing) {
      throw new Error('Email already exists');
    }

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

    return user as UserWithRelations;
  }

  /**
   * Update user
   */
  async update(
    unitId: string,
    req: UpdateUserInput,
  ): Promise<UserWithRelations> {
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

    return user as UserWithRelations;
  }

  /**
   * Delete user by unitId
   */
  async delete(unitId: string): Promise<void> {
    await prisma.user.delete({where: {unitId}});
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

    return isPasswordValid(password, user.passwordHash);
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

    const isValid = isPasswordValid(password, user.passwordHash);
    if (!isValid) {
      return null;
    }

    return user;
  }
}

// Export singleton instance
export const userService = new UserService();
