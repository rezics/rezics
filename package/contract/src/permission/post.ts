import type { UnitDTO, UserDTO } from "../index";
import { BasicAdminPermission, isBlocked } from "./core";

export function hasPermissionToUpdatePost(
  user: UserDTO,
  unit?: UnitDTO,
): boolean {
  if (isBlocked(user)) return false;
  if (BasicAdminPermission(user)) return true;
  if (!unit?.user?.unitId) return false;
  return user.unitId === unit.user.unitId;
}

export function hasPermissionToDeletePost(
  user: UserDTO,
  unit?: UnitDTO,
): boolean {
  return hasPermissionToUpdatePost(user, unit);
}
