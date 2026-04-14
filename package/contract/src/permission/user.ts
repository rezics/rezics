import type { Permission } from "./core";
import { BasicAdminPermission, isBlocked } from "./core";

export function hasPermissionToUpdateUser(
  permission: Permission,
  actorUnitId: string,
  targetUnitId: string,
): boolean {
  if (isBlocked(permission)) return false;
  if (BasicAdminPermission(permission)) return true;
  return actorUnitId === targetUnitId;
}

export function hasPermissionToDeleteUser(
  permission: Permission,
  actorUnitId: string,
  targetUnitId: string,
): boolean {
  if (isBlocked(permission)) return false;
  return actorUnitId === targetUnitId;
}
