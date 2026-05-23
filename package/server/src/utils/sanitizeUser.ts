import type { PublicUser } from "@rezics/contract";
import type { Prisma } from "#/prisma/client";

/**
 * Prisma select that returns only PublicUser fields (excluding slug — slug
 * now lives on the USER Unit). Callers attach `slug` separately via a Unit
 * lookup.
 */
export const publicUserSelect = {
  unitId: true,
  name: true,
  avatar: true,
  bio: true,
  description: true,
  followersCount: true,
  followingsCount: true,
} satisfies Prisma.UserSelect;

export type PublicUserSelected = {
  unitId: string;
  slug?: string | null;
  name: string | null;
  avatar: string | null;
  bio?: string | null;
  description?: unknown;
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
    description: user.description as PublicUser["description"],
    followersCount: user.followersCount,
    followingsCount: user.followingsCount,
  };
}
