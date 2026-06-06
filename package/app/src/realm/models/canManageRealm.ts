import type { Permission } from "@rezics/contract";

const MANAGE_ROLES = ["owner", "admin", "moderator"];

export function canManageRealm({
  permission,
  memberRoleKey,
}: {
  permission?: Permission | null;
  memberRoleKey?: string | null;
}): boolean {
  if (permission?.role === "ADMIN" || permission?.role === "ROOT") return true;
  if (memberRoleKey && MANAGE_ROLES.includes(memberRoleKey)) return true;
  return false;
}
