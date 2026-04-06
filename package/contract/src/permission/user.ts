import type { UserDTO } from "../index";
import { BasicAdminPermission, isBlocked } from "./core";

/**
 * User-level permissions.
 *
 * These helpers mirror the logic used in `userApi` routes:
 * - A user can always manage their own profile.
 * - ADMIN / ROOT can manage any user (for update).
 * - BLOCKED users are denied for safety.
 */

export function hasPermissionToUpdateUser(
  currentUser: UserDTO,
  targetUnitId: string,
): boolean {
  if (isBlocked(currentUser)) {
    return false;
  }
  if (BasicAdminPermission(currentUser)) {
    return true;
  }
  return currentUser.unitId === targetUnitId;
}

/**
 * For now, deleting users is restricted to self-deletion,
 * matching the current server behaviour.
 */
export function hasPermissionToDeleteUser(
  currentUser: UserDTO,
  targetUnitId: string,
): boolean {
  if (isBlocked(currentUser)) {
    return false;
  }
  return currentUser.unitId === targetUnitId;
}
