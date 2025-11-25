import type {UserDTO} from '../index';

export function verifyRoot(user: UserDTO): boolean {
  if (!user.permission?.role) {
    return false;
  }
  return user.permission?.role?.includes('ROOT');
}

export function verifyAdmin(user: UserDTO): boolean {
  if (!user.permission?.role) {
    return false;
  }
  return user.permission?.role?.includes('ADMIN');
}

export function verifyBlocked(user: UserDTO): boolean {
  if (!user.permission?.role) {
    return true;
  }
  return user.permission?.role?.includes('BLOCKED');
}
