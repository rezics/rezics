// Comment permissions — DEPRECATED: use post permissions instead.
// Kept as aliases for backward compatibility during migration.
import type { UnitDTO, UserDTO } from "../index";
import { BasicAdminPermission, isBlocked } from "./core";

/** @deprecated Use hasPermissionToUpdatePost */
export function hasPermissionToUpdateComment(
  user: UserDTO,
  unit?: UnitDTO,
): boolean {
  if (isBlocked(user)) return false;
  if (BasicAdminPermission(user)) return true;
  return user.unitId === unit?.user?.unitId;
}

/** @deprecated Use hasPermissionToDeletePost */
export function hasPermissionToDeleteComment(
  user: UserDTO,
  unit?: UnitDTO,
): boolean {
  return hasPermissionToUpdateComment(user, unit);
}
