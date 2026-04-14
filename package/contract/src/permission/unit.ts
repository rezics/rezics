import type { UnitDTO } from "../index";
import type { AuthIdentity } from "./core";
import { BasicAdminPermission, isBlocked } from "./core";

function isUnitOwner(actor: AuthIdentity, unit?: UnitDTO): boolean {
  if (!unit?.user?.unitId) return false;
  return actor.unitId === unit.user.unitId;
}

export function hasPermissionToUpdateUnit(
  actor: AuthIdentity,
  unit?: UnitDTO,
): boolean {
  if (isBlocked(actor)) return false;
  if (BasicAdminPermission(actor)) return true;
  return isUnitOwner(actor, unit);
}

export function hasPermissionToDeleteUnit(
  actor: AuthIdentity,
  unit?: UnitDTO,
): boolean {
  return hasPermissionToUpdateUnit(actor, unit);
}
