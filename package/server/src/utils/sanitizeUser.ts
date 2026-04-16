import type { PublicUser } from '@rezics/contract';
import type { Prisma, User } from '#/prisma/client';

/**
 * Prisma select that returns only PublicUser fields.
 * Use `user: { select: publicUserSelect }` in domain includes
 * instead of `user: true` + post-query sanitizeUser().
 */
export const publicUserSelect = {
  unitId: true,
  slug: true,
  name: true,
  avatar: true,
  bio: true,
  description: true,
  followersCount: true,
  followingsCount: true,
} satisfies Prisma.UserSelect;

/**
 * Sanitize user data for public response — base version.
 *
 * @deprecated Use `publicUserSelect` with Prisma select instead.
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
 * @deprecated Use `publicUserSelect` with Prisma select instead.
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
