import type { PublicUser } from "@rezics/contract";

/**
 * Select shape for PublicUser fields (excluding slug — slug now lives on the
 * USER Unit). Callers attach `slug` separately via a Unit lookup.
 */
export const publicUserSelect = {
  unitId: true,
  name: true,
  avatar: true,
  summary: true,
  description: true,
  followersCount: true,
  followingsCount: true,
} as const;

export type PublicUserSelected = {
  unitId: string;
  slug?: string | null;
  name: string | null;
  avatar: string | null;
  summary?: string | null;
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
    summary: user.summary ?? undefined,
    description: user.description as PublicUser["description"],
    followersCount: user.followersCount,
    followingsCount: user.followingsCount,
  };
}
