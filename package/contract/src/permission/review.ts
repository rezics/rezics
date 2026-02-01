import type {UserDTO, UnitDTO} from '../index';
import {BasicAdminPermission, isBlocked} from './core';

/**
 * Review permissions.
 *
 * Reviews are also backed by a `Unit` (Unit.type = REVIEW or REMARK).
 * Server-side code currently enforces:
 * - ADMIN can always modify/delete any review.
 * - Otherwise, only the owner of the underlying Unit can modify/delete.
 */

export function hasPermissionToUpdateReview(
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

export function hasPermissionToDeleteReview(
  user: UserDTO,
  unit?: UnitDTO,
): boolean {
  return hasPermissionToUpdateReview(user, unit);
}
