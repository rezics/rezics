import type {UserDTO, BookDTO, UnitDTO} from '../index';
import {BasicAdminPermission, isBlocked} from './core';

export function hasPermissionToUpdateBook(
  user: UserDTO,
  _book?: BookDTO,
  unit?: UnitDTO,
): boolean {
  if (isBlocked(user)) return false;
  if (BasicAdminPermission(user)) return true;
  if (!unit?.user?.unitId) return false;
  return user.unitId === unit.user.unitId;
}

/**
 * Delete-book permission. For now we mirror the update logic:
 * - BLOCKED users: never allowed.
 * - ROOT / ADMIN: always allowed.
 * - Otherwise: only the owner of the book's Unit can delete.
 */
export function hasPermissionToDeleteBook(
  user: UserDTO,
  unit?: UnitDTO,
): boolean {
  return hasPermissionToUpdateBook(user, undefined, unit);
}
