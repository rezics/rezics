import type { Permission, RealmMemberRole } from "@rezics/contract";

const MANAGE_ROLES: readonly RealmMemberRole[] = [
  "owner",
  "admin",
  "moderator",
];

export function canManageRealm({
  permission,
  memberRoleKey,
}: {
  permission?: Permission | null;
  memberRoleKey?: string | null;
}): boolean {
  if (permission?.role === "ADMIN" || permission?.role === "ROOT") return true;
  if (
    memberRoleKey &&
    (MANAGE_ROLES as readonly string[]).includes(memberRoleKey)
  )
    return true;
  return false;
}
