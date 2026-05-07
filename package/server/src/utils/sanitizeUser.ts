import type { PublicUser } from "@rezics/contract";
import type { Prisma, User } from "#/prisma/client";

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

export type PublicUserSelected = {
  unitId: string;
  slug: string | null;
  name: string | null;
  avatar: string | null;
  bio?: string | null;
  description?: string | null;
  followersCount?: number;
  followingsCount?: number;
};

export function mapPublicUser(
  user: PublicUserSelected | null | undefined,
): PublicUser | undefined {
  if (!user) return undefined;
  return {
    unitId: user.unitId,
    slug: user.slug ?? undefined,
    name: user.name ?? undefined,
    avatar: user.avatar ?? null,
    bio: user.bio ?? undefined,
    description: user.description ?? undefined,
    followersCount: user.followersCount,
    followingsCount: user.followingsCount,
  };
}

/**
 * Sanitize user data for public response — base version.
 *
 * @deprecated Use `publicUserSelect` with Prisma select instead.
 */
export function sanitizeUser(
  u: Pick<User, "unitId" | "name"> & Partial<Pick<User, "slug" | "avatar">>,
): PublicUser {
  return mapPublicUser({
    unitId: u.unitId,
    slug: u.slug ?? null,
    name: u.name,
    avatar: u.avatar ?? null,
  })!;
}

/**
 * Sanitize user data for public response — extended version with profile info.
 *
 * @deprecated Use `publicUserSelect` with Prisma select instead.
 */
export function sanitizeUserWithBio(u: User): PublicUser {
  return mapPublicUser(u)!;
}
