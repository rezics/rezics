import type { Permission, UnitDTO } from "@rezics/contract";
import {
  hasPermissionToUpdateBook,
  hasPermissionToUpdateChapter,
  hasPermissionToUpdatePost,
  hasPermissionToUpdateShelf,
  hasPermissionToUpdateTag,
  hasPermissionToUpdateUnit,
} from "@rezics/contract";
import { useCurrentUnitId } from "./useCurrentUnitId";
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
  actorUnitId: string | null,
  resource: EditableResource,
  ownerUnit: OwnerBearing,
): boolean {
  if (!permission || !actorUnitId) return false;

  const unit = ownerUnit as UnitDTO | undefined;

  switch (resource) {
    case "book":
      return hasPermissionToUpdateBook(
        permission,
        actorUnitId,
        undefined,
        unit,
      );
    case "chapter":
      return hasPermissionToUpdateChapter(permission, actorUnitId, unit);
    case "post":
      return hasPermissionToUpdatePost(permission, actorUnitId, unit);
    case "shelf":
      return hasPermissionToUpdateShelf(permission, actorUnitId, unit);
    case "tag":
      return hasPermissionToUpdateTag(permission, actorUnitId, unit);
    case "unit":
      return hasPermissionToUpdateUnit(permission, actorUnitId, unit);
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
  const actorUnitId = useCurrentUnitId();
  return computeCanEdit(permission, actorUnitId, resource, ownerUnit);
}
