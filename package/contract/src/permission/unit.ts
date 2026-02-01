import type {UserDTO, UnitDTO} from '../index';
import {BasicAdminPermission, isBlocked} from './core';

/**
 * Generic Unit ownership based permission helpers.
 *
 * Most resources in the system (books, chapters, readlists, reviews, etc.)
 * are ultimately backed by a `Unit`. These helpers encapsulate the common
 * "owner or admin" rule while also respecting BLOCKED users.
 */

function isUnitOwner(user: UserDTO, unit?: UnitDTO): boolean {
  if (!unit?.user?.unitId) {
    return false;
  }
  return user.unitId === unit.user.unitId;
}

/**
 * Permissions for updating a Unit-backed resource.
 *
 * - BLOCKED users: never allowed.
 * - ROOT / ADMIN: always allowed.
 * - Otherwise: only the owner of the Unit can update.
 */
export function hasPermissionToUpdateUnit(
  user: UserDTO,
  unit?: UnitDTO,
): boolean {
  if (isBlocked(user)) {
    return false;
  }
  if (BasicAdminPermission(user)) {
    return true;
  }
  return isUnitOwner(user, unit);
}

/**
 * Permissions for deleting a Unit-backed resource.
 *
 * For now we mirror the update rule: owner or admin, and not BLOCKED.
 * Individual modules can wrap this if they need stricter semantics.
 */
export function hasPermissionToDeleteUnit(
  user: UserDTO,
  unit?: UnitDTO,
): boolean {
  return hasPermissionToUpdateUnit(user, unit);
}
