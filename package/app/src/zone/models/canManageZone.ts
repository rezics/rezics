import type { Permission, RealmMemberRole } from "@rezics/contract";

const ZONE_OWNER_REALM_MANAGE_ROLES: readonly RealmMemberRole[] = [
  "owner",
  "admin",
  "moderator",
];

export function canManageZone({
  permission,
  ownerRealmMemberRoleKey,
}: {
  permission?: Permission | null;
  ownerRealmMemberRoleKey?: string | null;
}): boolean {
  if (permission?.role === "ADMIN" || permission?.role === "ROOT") return true;
  if (
    ownerRealmMemberRoleKey &&
    (ZONE_OWNER_REALM_MANAGE_ROLES as readonly string[]).includes(
      ownerRealmMemberRoleKey,
    )
  ) {
    return true;
  }
  return false;
}
