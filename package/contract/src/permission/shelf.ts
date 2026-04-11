import type { UnitDTO, UserDTO } from "../index";
import { BasicAdminPermission, isBlocked } from "./core";

export function hasPermissionToUpdateShelf(
  user: UserDTO,
  unit?: UnitDTO,
): boolean {
  if (isBlocked(user)) return false;
  if (BasicAdminPermission(user)) return true;
  if (!unit?.user?.unitId) return false;
  return user.unitId === unit.user.unitId;
}

export function hasPermissionToDeleteShelf(
  user: UserDTO,
  unit?: UnitDTO,
): boolean {
  return hasPermissionToUpdateShelf(user, unit);
}
