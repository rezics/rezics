import type {UserDTO, BookDTO, UnitDTO} from '../index';

export function hasPermissionToUpdateBook(
  user: UserDTO,
  book?: BookDTO,
  unit?: UnitDTO,
): boolean {
  if (user.permission?.role?.includes('ADMIN')) {
    return true;
  }
  if (user.unitId === unit?.user?.unitId) {
    return true;
  }
  return false;
}
