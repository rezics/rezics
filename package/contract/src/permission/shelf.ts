// Widened to UnitOwnershipRef so server-internal UnitWithRelations satisfies the parameter
// without needing `as any`. UnitDTO also satisfies it structurally.
// 参数类型扩宽为 UnitOwnershipRef，使服务端内部的 UnitWithRelations 无需 `as any` 即可满足；
// UnitDTO 在结构上同样满足此接口。
import type { UnitOwnershipRef } from "./unit";
import type { Permission } from "./core";
import { BasicAdminPermission, isBlocked } from "./core";

export function hasPermissionToUpdateShelf(
  permission: Permission,
  actorUserId: string,
  unit?: UnitOwnershipRef,
): boolean {
  if (isBlocked(permission)) return false;
  if (BasicAdminPermission(permission)) return true;
  if (!unit?.user?.unitId) return false;
  return actorUserId === unit.user.unitId;
}

export function hasPermissionToDeleteShelf(
  permission: Permission,
  actorUserId: string,
  unit?: UnitOwnershipRef,
): boolean {
  return hasPermissionToUpdateShelf(permission, actorUserId, unit);
}
