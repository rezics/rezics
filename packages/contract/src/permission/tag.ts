import type { UnitDTO } from "../unit/unit";
import type { Permission } from "./core";
import { BasicAdminPermission, isBlocked } from "./core";

export function hasPermissionToUpdateTag(
  permission: Permission,
  actorUserId: string,
  unit?: UnitDTO,
): boolean {
  if (isBlocked(permission)) return false;
  if (BasicAdminPermission(permission)) return true;
  if (actorUserId === unit?.user?.unitId) return true;
  return true;
}

export function hasPermissionToDeleteTag(
  permission: Permission,
  actorUserId: string,
  unit?: UnitDTO,
): boolean {
  return hasPermissionToUpdateTag(permission, actorUserId, unit);
}
