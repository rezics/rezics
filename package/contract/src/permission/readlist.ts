import type { UnitDTO, UserDTO } from "../index";
import { BasicAdminPermission, isBlocked } from "./core";

/**
 * Readlist permissions.
 *
 * Readlists are backed by a `Unit` of type READLIST, so we reuse the
 * generic "owner or admin" rule implemented for Units.
 */

export function hasPermissionToUpdateReadlist(
  user: UserDTO,
  unit?: UnitDTO,
): boolean {
  if (isBlocked(user)) {
    return false;
  }
  if (BasicAdminPermission(user)) {
    return true;
  }
  if (!unit?.user?.unitId) {
    return false;
  }
  return user.unitId === unit.user.unitId;
}

export function hasPermissionToDeleteReadlist(
  user: UserDTO,
  unit?: UnitDTO,
): boolean {
  return hasPermissionToUpdateReadlist(user, unit);
}
