import type { UnitDTO } from "../index";
import type { AuthIdentity } from "./core";
import { BasicAdminPermission, isBlocked } from "./core";

export function hasPermissionToUpdateTag(
  actor: AuthIdentity,
  unit?: UnitDTO,
): boolean {
  if (isBlocked(actor)) return false;
  if (BasicAdminPermission(actor)) return true;
  if (actor.unitId === unit?.user?.unitId) return true;
  return true;
}

export function hasPermissionToDeleteTag(
  actor: AuthIdentity,
  unit?: UnitDTO,
): boolean {
  return hasPermissionToUpdateTag(actor, unit);
}
