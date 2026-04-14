// Readlist permissions — DEPRECATED: use shelf permissions instead.
// Kept as aliases for backward compatibility during migration.
import type { UnitDTO } from "../index";
import type { AuthIdentity } from "./core";
import { BasicAdminPermission, isBlocked } from "./core";

/** @deprecated Use hasPermissionToUpdateShelf */
export function hasPermissionToUpdateReadlist(
  actor: AuthIdentity,
  unit?: UnitDTO,
): boolean {
  if (isBlocked(actor)) return false;
  if (BasicAdminPermission(actor)) return true;
  if (!unit?.user?.unitId) return false;
  return actor.unitId === unit.user.unitId;
}

/** @deprecated Use hasPermissionToDeleteShelf */
export function hasPermissionToDeleteReadlist(
  actor: AuthIdentity,
  unit?: UnitDTO,
): boolean {
  return hasPermissionToUpdateReadlist(actor, unit);
}
