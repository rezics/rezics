import type {UserDTO} from '../index';

export function isAdmin(user: UserDTO) {
  if (user.permission?.role?.includes('ADMIN')) {
    return true;
  }
}

export function isRoot(user: UserDTO) {
  if (user.permission?.role?.includes('ROOT')) {
    return true;
  }
}

export function BasicAdminPermission(user: UserDTO) {
  return isAdmin(user) || isRoot(user);
}

export function isBlocked(user: UserDTO) {
  if (user.permission?.role?.includes('BLOCKED')) {
    return true;
  }
}
