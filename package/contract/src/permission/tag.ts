import type { UnitDTO } from "../index";
import type { Permission } from "./core";
import { BasicAdminPermission, isBlocked } from "./core";

export function hasPermissionToUpdateTag(
  permission: Permission,
  actorUnitId: string,
  unit?: UnitDTO,
): boolean {
  if (isBlocked(permission)) return false;
  if (BasicAdminPermission(permission)) return true;
  if (actorUnitId === unit?.user?.unitId) return true;
  return true;
}

export function hasPermissionToDeleteTag(
  permission: Permission,
  actorUnitId: string,
  unit?: UnitDTO,
): boolean {
  return hasPermissionToUpdateTag(permission, actorUnitId, unit);
}
