import type { Permission } from "./core";
import { BasicAdminPermission, isBlocked } from "./core";
import type { UnitOwnershipRef } from "./unit";

export function hasPermissionToUpdateBook(
  permission: Permission,
  actorUserId: string,
  _book?: unknown,
  unit?: UnitOwnershipRef,
): boolean {
  if (isBlocked(permission)) return false;
  if (BasicAdminPermission(permission)) return true;
  if (!unit?.user?.unitId) return false;
  return actorUserId === unit.user.unitId;
}

export function hasPermissionToDeleteBook(
  permission: Permission,
  actorUserId: string,
  unit?: UnitOwnershipRef,
): boolean {
  return hasPermissionToUpdateBook(permission, actorUserId, undefined, unit);
}
