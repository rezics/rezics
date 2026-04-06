import type { UnitDTO, UserDTO } from "../index";
import { BasicAdminPermission, isBlocked } from "./core";

export function hasPermissionToUpdateComment(
  user: UserDTO,
  unit?: UnitDTO,
): boolean {
  if (isBlocked(user)) {
    return false;
  }
  if (BasicAdminPermission(user)) {
    return true;
  }
  if (user.unitId === unit?.user?.unitId) {
    return true;
  }
  return false;
}

export function hasPermissionToDeleteComment(
  user: UserDTO,
  unit?: UnitDTO,
): boolean {
  return hasPermissionToUpdateComment(user, unit);
}
