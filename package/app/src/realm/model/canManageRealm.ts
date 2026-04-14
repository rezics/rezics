const MANAGE_ROLES = ['owner', 'admin', 'moderator'];

export function canManageRealm({
  globalRole,
  memberRoleKey,
}: {
  globalRole?: string | null;
  memberRoleKey?: string | null;
}): boolean {
  if (globalRole === 'ADMIN' || globalRole === 'ROOT') return true;
  if (memberRoleKey && MANAGE_ROLES.includes(memberRoleKey)) return true;
  return false;
}
