import type { AuthIdentity } from "./core";
import { BasicAdminPermission, isBlocked } from "./core";

export function hasPermissionToUpdateUser(
  actor: AuthIdentity,
  targetUnitId: string,
): boolean {
  if (isBlocked(actor)) return false;
  if (BasicAdminPermission(actor)) return true;
  return actor.unitId === targetUnitId;
}

export function hasPermissionToDeleteUser(
  actor: AuthIdentity,
  targetUnitId: string,
): boolean {
  if (isBlocked(actor)) return false;
  return actor.unitId === targetUnitId;
}
