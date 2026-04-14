import type { UnitDTO } from "../index";
import type { Permission } from "./core";
import { BasicAdminPermission, isBlocked } from "./core";

function isUnitOwner(actorUnitId: string, unit?: UnitDTO): boolean {
  if (!unit?.user?.unitId) return false;
  return actorUnitId === unit.user.unitId;
}

export function hasPermissionToUpdateUnit(
  permission: Permission,
  actorUnitId: string,
  unit?: UnitDTO,
): boolean {
  if (isBlocked(permission)) return false;
  if (BasicAdminPermission(permission)) return true;
  return isUnitOwner(actorUnitId, unit);
}

export function hasPermissionToDeleteUnit(
  permission: Permission,
  actorUnitId: string,
  unit?: UnitDTO,
): boolean {
  return hasPermissionToUpdateUnit(permission, actorUnitId, unit);
}
