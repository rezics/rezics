import type { Permission, UnitDTO } from "@rezics/contract";
import {
  BasicAdminPermission,
  hasPermissionToUpdateBook,
  hasPermissionToUpdateChapter,
  hasPermissionToUpdatePost,
  hasPermissionToUpdateShelf,
  hasPermissionToUpdateTag,
  hasPermissionToUpdateUnit,
} from "@rezics/contract";
import { useCurrentUserId } from "./useCurrentUserId";
import { useServerPermission } from "./useServerPermission";

export type EditableResource =
  | "book"
  | "chapter"
  | "post"
  | "shelf"
  | "tag"
  | "unit";

/**
 * Minimal shape every content DTO exposes for ownership checks — the contract
 * helpers only read `user.unitId`, so we accept any DTO that provides it
 * (BookDTO, ShelfDTO, UnitDTO, PostDTO, …).
 */
export type OwnerBearing = { user?: { unitId?: string } | null } | undefined;

export type UseCanEditArgs = {
  resource: EditableResource;
  ownerUnit: OwnerBearing;
};

export function computeCanEdit(
  permission: Permission | null,
  actorUserId: string | null,
  resource: EditableResource,
  ownerUnit: OwnerBearing,
): boolean {
  if (!permission) return false;
  if (BasicAdminPermission(permission)) return true;
  if (!actorUserId) return false;

  const unit = ownerUnit as UnitDTO | undefined;

  switch (resource) {
    case "book":
      return hasPermissionToUpdateBook(
        permission,
        actorUserId,
        undefined,
        unit,
      );
    case "chapter":
      return hasPermissionToUpdateChapter(permission, actorUserId, unit);
    case "post":
      return hasPermissionToUpdatePost(permission, actorUserId, unit);
    case "shelf":
      return hasPermissionToUpdateShelf(permission, actorUserId, unit);
    case "tag":
      return hasPermissionToUpdateTag(permission, actorUserId, unit);
    case "unit":
      return hasPermissionToUpdateUnit(permission, actorUserId, unit);
  }
}

/**
 * Returns whether the current viewer can edit the given content.
 *
 * Flat visibility rule: owner, admin, and root all return `true` — the UI
 * does not distinguish between them. Returns `false` for unauthenticated
 * viewers, blocked roles, a missing `ownerUnit`, or owner mismatch.
 */
export function useCanEdit({ resource, ownerUnit }: UseCanEditArgs): boolean {
  const permission = useServerPermission();
  const actorUserId = useCurrentUserId();
  return computeCanEdit(permission, actorUserId, resource, ownerUnit);
}
