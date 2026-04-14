import type { UnitDTO } from "../index";
import type { AuthIdentity } from "./core";
import { BasicAdminPermission, isBlocked } from "./core";

export function hasPermissionToUpdateChapter(
  actor: AuthIdentity,
  unit?: UnitDTO,
): boolean {
  if (isBlocked(actor)) return false;
  if (BasicAdminPermission(actor)) return true;
  if (!unit?.user?.unitId) return false;
  return actor.unitId === unit.user.unitId;
}

export function hasPermissionToDeleteChapter(
  actor: AuthIdentity,
  unit?: UnitDTO,
): boolean {
  return hasPermissionToUpdateChapter(actor, unit);
}
