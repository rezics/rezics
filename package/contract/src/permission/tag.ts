import type {UserDTO, UnitDTO} from '../index';
import {BasicAdminPermission, isBlocked} from './core';

export function hasPermissionToUpdateTag(
  user: UserDTO,
  unit?: UnitDTO,
): boolean {
  if (isBlocked(user)) {
    return false;
  }
  if (BasicAdminPermission(user)) {
    return true;
  }
  if (user.unitId == unit?.user?.unitId) {
    return true;
  }
  return true;
}

export function hasPermissionToDeleteTag(
  user: UserDTO,
  unit?: UnitDTO,
): boolean {
  return hasPermissionToUpdateTag(user, unit);
}
