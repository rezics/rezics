import type { UserDTO } from "@rezics/contract";
import type { User } from "../../db/schema";
import type { UserWithRelations } from "./types";

type UserLike = (typeof User.$inferSelect | UserWithRelations) & {
  slug?: string | null;
};

/**
 * Map internal User model to UserDTO (public data).
 *
 * Slug is read from the user object — services that load Users SHALL attach
 * `slug` from the matching USER `Unit.slug` so DTO mappers can include it.
 */
export function mapUserToDTO(user: UserLike): UserDTO {
  return {
    unitId: user.unitId,
    email: user.email ?? undefined,
    slug: user.slug ?? undefined,
    name: user.name ?? undefined,
    avatar: user.avatar || undefined,
    summary: user.summary || undefined,
    description: user.description as UserDTO["description"],
    followersCount: user.followersCount,
    followingsCount: user.followingsCount,
    permission: user.permission as { role: string[] } | undefined,
    joinDate: user.joinDate?.toISOString(),
  };
}

/**
 * Map User to public profile
 */
export function mapUserToPublicProfile(user: UserLike): UserDTO {
  return {
    unitId: user.unitId,
    slug: user.slug ?? undefined,
    name: user.name ?? undefined,
    avatar: user.avatar || undefined,
    summary: user.summary || undefined,
    description: user.description as UserDTO["description"],
    followersCount: user.followersCount,
    followingsCount: user.followingsCount,
    joinDate: user.joinDate?.toISOString(),
  };
}
