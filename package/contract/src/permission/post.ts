import type { UnitDTO } from "../index";
import type { Permission } from "./core";
import { BasicAdminPermission, isBlocked } from "./core";

export function hasPermissionToUpdatePost(
  permission: Permission,
  actorUserId: string,
  unit?: UnitDTO,
): boolean {
  if (isBlocked(permission)) return false;
  if (BasicAdminPermission(permission)) return true;
  if (!unit?.user?.userId) return false;
  return actorUserId === unit.user.userId;
}

export function hasPermissionToDeletePost(
  permission: Permission,
  actorUserId: string,
  unit?: UnitDTO,
): boolean {
  return hasPermissionToUpdatePost(permission, actorUserId, unit);
}
