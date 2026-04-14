// Comment permissions — DEPRECATED: use post permissions instead.
// Kept as aliases for backward compatibility during migration.
import type { UnitDTO } from "../index";
import type { Permission } from "./core";
import { BasicAdminPermission, isBlocked } from "./core";

/** @deprecated Use hasPermissionToUpdatePost */
export function hasPermissionToUpdateComment(
  permission: Permission,
  actorUnitId: string,
  unit?: UnitDTO,
): boolean {
  if (isBlocked(permission)) return false;
  if (BasicAdminPermission(permission)) return true;
  return actorUnitId === unit?.user?.unitId;
}

/** @deprecated Use hasPermissionToDeletePost */
export function hasPermissionToDeleteComment(
  permission: Permission,
  actorUnitId: string,
  unit?: UnitDTO,
): boolean {
  return hasPermissionToUpdateComment(permission, actorUnitId, unit);
}
