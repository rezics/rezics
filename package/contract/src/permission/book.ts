import type { BookDTO, UnitDTO } from "../index";
import type { AuthIdentity } from "./core";
import { BasicAdminPermission, isBlocked } from "./core";

export function hasPermissionToUpdateBook(
  actor: AuthIdentity,
  _book?: BookDTO,
  unit?: UnitDTO,
): boolean {
  if (isBlocked(actor)) return false;
  if (BasicAdminPermission(actor)) return true;
  if (!unit?.user?.unitId) return false;
  return actor.unitId === unit.user.unitId;
}

/**
 * Delete-book permission. For now we mirror the update logic:
 * - BLOCKED users: never allowed.
 * - ROOT / ADMIN: always allowed.
 * - Otherwise: only the owner of the book's Unit can delete.
 */
export function hasPermissionToDeleteBook(
  actor: AuthIdentity,
  unit?: UnitDTO,
): boolean {
  return hasPermissionToUpdateBook(actor, undefined, unit);
}
