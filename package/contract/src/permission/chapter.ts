import type { UnitDTO } from "../index";
import type { Permission } from "./core";
import { BasicAdminPermission, isBlocked } from "./core";

export function hasPermissionToUpdateChapter(
  permission: Permission,
  actorUnitId: string,
  unit?: UnitDTO,
): boolean {
  if (isBlocked(permission)) return false;
  if (BasicAdminPermission(permission)) return true;
  if (!unit?.user?.unitId) return false;
  return actorUnitId === unit.user.unitId;
}

export function hasPermissionToDeleteChapter(
  permission: Permission,
  actorUnitId: string,
  unit?: UnitDTO,
): boolean {
  return hasPermissionToUpdateChapter(permission, actorUnitId, unit);
}
