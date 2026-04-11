import type { UserDTO, UserSearchDocument } from "@rezics/contract";

/**
 * Map a Meili user document into full `UserDTO`.
 * Mainly used by token/admin flows where permission is required.
 */
export function mapUserSearchDocToDTO(doc: UserSearchDocument): UserDTO {
  return {
    unitId: doc.unitId,
    slug: doc.slug ?? undefined,
    name: doc.name,
    avatar: doc.avatar ?? undefined,
    bio: doc.bio ?? undefined,
    description: doc.description ?? undefined,
    followersCount: doc.followersCount ?? undefined,
    followingsCount: doc.followingsCount ?? undefined,
    permission: doc.permission,
    joinDate: doc.joinDate
      ? typeof doc.joinDate === "string"
        ? doc.joinDate
        : doc.joinDate.toISOString()
      : undefined,
  };
}

/**
 * Map a Meili user document into a public profile
 * (without sensitive fields like permission).
 */
export function mapUserSearchDocToPublicProfile(
  doc: UserSearchDocument,
): UserDTO {
  return {
    unitId: doc.unitId,
    slug: doc.slug ?? undefined,
    name: doc.name,
    avatar: doc.avatar ?? undefined,
    bio: doc.bio ?? undefined,
    description: doc.description ?? undefined,
    followersCount: doc.followersCount ?? undefined,
    followingsCount: doc.followingsCount ?? undefined,
    joinDate: doc.joinDate
      ? typeof doc.joinDate === "string"
        ? doc.joinDate
        : doc.joinDate.toISOString()
      : undefined,
  };
}
