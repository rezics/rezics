import {
  SYSTEM_SHELF_KIND_KEYS,
  type SystemShelvesMap,
  type UserDTO,
} from "@rezics/contract";
import type { User } from "#/prisma/client";
import type { UserWithRelations } from "./types";

function extractSystemShelves(extra: User["extra"]): SystemShelvesMap | undefined {
  if (!extra || typeof extra !== "object" || Array.isArray(extra)) return undefined;
  const shelves = (extra as Record<string, unknown>).shelves;
  if (!shelves || typeof shelves !== "object" || Array.isArray(shelves)) {
    return undefined;
  }
  const out: SystemShelvesMap = {};
  for (const key of SYSTEM_SHELF_KIND_KEYS) {
    const value = (shelves as Record<string, unknown>)[key];
    if (typeof value === "string") {
      out[key] = value;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export type MapUserOptions = {
  /** Include private fields like systemShelves; only set on the /me path. */
  includePrivate?: boolean;
};

/**
 * Map internal User model to UserDTO (public data)
 */
export function mapUserToDTO(
  user: User | UserWithRelations,
  options: MapUserOptions = {},
): UserDTO {
  return {
    userId: user.userId,
    email: user.email ?? undefined,
    slug: user.slug ?? undefined,
    name: user.name ?? undefined,
    avatar: user.avatar || undefined,
    bio: user.bio || undefined,
    description: user.description || undefined,
    followersCount: user.followersCount,
    followingsCount: user.followingsCount,
    permission: user.permission as { role: string[] } | undefined,
    joinDate: user.joinDate?.toISOString(),
    ...(options.includePrivate
      ? { systemShelves: extractSystemShelves(user.extra) }
      : {}),
  };
}

/**
 * Map User to public profile
 */
export function mapUserToPublicProfile(
  user: User | UserWithRelations,
): UserDTO {
  return {
    userId: user.userId,
    slug: user.slug ?? undefined,
    name: user.name ?? undefined,
    avatar: user.avatar || undefined,
    bio: user.bio || undefined,
    description: user.description || undefined,
    followersCount: user.followersCount,
    followingsCount: user.followingsCount,
    joinDate: user.joinDate?.toISOString(),
  };
}
