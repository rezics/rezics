// Readlist permissions — DEPRECATED: use shelf permissions instead.
// Kept as aliases for backward compatibility during migration.
import type { UnitDTO, UserDTO } from "../index";
import { BasicAdminPermission, isBlocked } from "./core";

/** @deprecated Use hasPermissionToUpdateShelf */
export function hasPermissionToUpdateReadlist(
  user: UserDTO,
  unit?: UnitDTO,
): boolean {
  if (isBlocked(user)) return false;
  if (BasicAdminPermission(user)) return true;
  if (!unit?.user?.unitId) return false;
  return user.unitId === unit.user.unitId;
}

/** @deprecated Use hasPermissionToDeleteShelf */
export function hasPermissionToDeleteReadlist(
  user: UserDTO,
  unit?: UnitDTO,
): boolean {
  return hasPermissionToUpdateReadlist(user, unit);
}
