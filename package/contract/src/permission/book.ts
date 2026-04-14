import type { UnitDTO } from "../index";
import type { Permission } from "./core";
import { BasicAdminPermission, isBlocked } from "./core";

export function hasPermissionToUpdateBook(
  permission: Permission,
  actorUnitId: string,
  _book?: unknown,
  unit?: UnitDTO,
): boolean {
  if (isBlocked(permission)) return false;
  if (BasicAdminPermission(permission)) return true;
  if (!unit?.user?.unitId) return false;
  return actorUnitId === unit.user.unitId;
}

export function hasPermissionToDeleteBook(
  permission: Permission,
  actorUnitId: string,
  unit?: UnitDTO,
): boolean {
  return hasPermissionToUpdateBook(permission, actorUnitId, undefined, unit);
}
