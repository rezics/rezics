// Comment permissions — DEPRECATED: use post permissions instead.
// Kept as aliases for backward compatibility during migration.
import type { UnitDTO } from "../index";
import type { AuthIdentity } from "./core";
import { BasicAdminPermission, isBlocked } from "./core";

/** @deprecated Use hasPermissionToUpdatePost */
export function hasPermissionToUpdateComment(
  actor: AuthIdentity,
  unit?: UnitDTO,
): boolean {
  if (isBlocked(actor)) return false;
  if (BasicAdminPermission(actor)) return true;
  return actor.unitId === unit?.user?.unitId;
}

/** @deprecated Use hasPermissionToDeletePost */
export function hasPermissionToDeleteComment(
  actor: AuthIdentity,
  unit?: UnitDTO,
): boolean {
  return hasPermissionToUpdateComment(actor, unit);
}
