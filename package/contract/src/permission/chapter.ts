import type { Permission } from "./core";
import { BasicAdminPermission, isBlocked } from "./core";
import type { UnitOwnershipRef } from "./unit";

export function hasPermissionToUpdateChapter(
  permission: Permission,
  actorUserId: string,
  unit?: UnitOwnershipRef,
): boolean {
  if (isBlocked(permission)) return false;
  if (BasicAdminPermission(permission)) return true;
  if (!unit?.user?.unitId) return false;
  return actorUserId === unit.user.unitId;
}

export function hasPermissionToDeleteChapter(
  permission: Permission,
  actorUserId: string,
  unit?: UnitOwnershipRef,
): boolean {
  return hasPermissionToUpdateChapter(permission, actorUserId, unit);
}
