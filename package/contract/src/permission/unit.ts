// Minimal structural type covering the only field read by ownership checks.
// 所有权检查中唯一读取的字段所构成的最小结构类型。
// Both UnitDTO and server-internal UnitWithRelations satisfy this interface,
// so permission helpers accept either without `as any`.
// UnitDTO 和服务端内部 UnitWithRelations 均满足此接口，从而无需 `as any`。
export type UnitOwnershipRef = {
  user?: { unitId: string } | null;
} | null;

import type { Permission } from "./core";
import { BasicAdminPermission, isBlocked } from "./core";

function isUnitOwner(actorUserId: string, unit?: UnitOwnershipRef): boolean {
  if (!unit?.user?.unitId) return false;
  return actorUserId === unit.user.unitId;
}

export function hasPermissionToUpdateUnit(
  permission: Permission,
  actorUserId: string,
  unit?: UnitOwnershipRef,
): boolean {
  if (isBlocked(permission)) return false;
  if (BasicAdminPermission(permission)) return true;
  return isUnitOwner(actorUserId, unit);
}

export function hasPermissionToDeleteUnit(
  permission: Permission,
  actorUserId: string,
  unit?: UnitOwnershipRef,
): boolean {
  return hasPermissionToUpdateUnit(permission, actorUserId, unit);
}
