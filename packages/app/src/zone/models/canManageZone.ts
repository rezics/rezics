import type { Permission } from "@rezics/contract";

const ZONE_OWNER_REALM_MANAGE_ROLES = ["owner", "admin", "moderator"];

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
    ZONE_OWNER_REALM_MANAGE_ROLES.includes(ownerRealmMemberRoleKey)
  ) {
    return true;
  }
  return false;
}
