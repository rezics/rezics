import type {UserDTO, UnitDTO} from '../index';

export function hasPermissionToTag(user: UserDTO, unit?: UnitDTO): boolean {
  if (user.permission?.role?.includes('ADMIN')) {
    return true;
  }
  if (user.unitId === unit?.user?.unitId) {
    return true;
  }
  return false;
}
