import type { Permission } from "./core";
import { BasicAdminPermission, isBlocked } from "./core";

export function hasPermissionToUpdateUser(
  permission: Permission,
  actorUserId: string,
  targetUnitId: string,
): boolean {
  if (isBlocked(permission)) return false;
  if (BasicAdminPermission(permission)) return true;
  return actorUserId === targetUnitId;
}

export function hasPermissionToDeleteUser(
  permission: Permission,
  actorUserId: string,
  targetUnitId: string,
): boolean {
  if (isBlocked(permission)) return false;
  return actorUserId === targetUnitId;
}
