import type { UnitDTO, UserDTO } from "../index";
import { BasicAdminPermission, isBlocked } from "./core";

/**
 * Chapter permissions.
 *
 * Chapters are also Unit-backed (Unit.type = CHAPTER). The current
 * server-side routes allow only the owning user to update/delete.
 * Here we generalize to:
 * - BLOCKED users: never allowed.
 * - ROOT / ADMIN: always allowed.
 * - Otherwise: only the owner of the Unit can modify.
 */

export function hasPermissionToUpdateChapter(
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

export function hasPermissionToDeleteChapter(
  user: UserDTO,
  unit?: UnitDTO,
): boolean {
  return hasPermissionToUpdateChapter(user, unit);
}
