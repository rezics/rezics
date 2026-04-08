import type { PublicUser } from '@rezics/contract';
import type { User } from '#/prisma/client';

/**
 * Sanitize user data for public response — base version.
 *
 * Accepts a full Prisma `User` or any partial shape with at least
 * `unitId` and `name` (e.g. Prisma select results).
 */
export function sanitizeUser(
  u: Pick<User, 'unitId' | 'name'> & Partial<Pick<User, 'slug' | 'avatar'>>,
): PublicUser {
  return {
    unitId: u.unitId,
    slug: u.slug,
    name: u.name,
    avatar: u.avatar ?? (null as any),
  };
}

/**
 * Sanitize user data for public response — extended version with profile info.
 *
 * Includes bio, description, and follow statistics.
 */
export function sanitizeUserWithBio(u: User): PublicUser {
  return {
    ...sanitizeUser(u),
    bio: u.bio ?? undefined,
    description: u.description ?? undefined,
    followersCount: u.followersCount,
    followingsCount: u.followingsCount,
  };
}
