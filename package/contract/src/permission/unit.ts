import type { UnitDTO } from "../unit/unit";
import type { Permission } from "./core";
import { BasicAdminPermission, isBlocked } from "./core";

function isUnitOwner(actorUserId: string, unit?: UnitDTO): boolean {
  if (!unit?.user?.unitId) return false;
  return actorUserId === unit.user.unitId;
}

export function hasPermissionToUpdateUnit(
  permission: Permission,
  actorUserId: string,
  unit?: UnitDTO,
): boolean {
  if (isBlocked(permission)) return false;
  if (BasicAdminPermission(permission)) return true;
  return isUnitOwner(actorUserId, unit);
}

export function hasPermissionToDeleteUnit(
  permission: Permission,
  actorUserId: string,
  unit?: UnitDTO,
): boolean {
  return hasPermissionToUpdateUnit(permission, actorUserId, unit);
}
