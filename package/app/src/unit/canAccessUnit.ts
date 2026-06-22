import { type UnitDTO, UnitStatus, UnitVisibility } from "@rezics/contract";

export type ViewerRef = { unitId?: string | null } | null | undefined;

export function canAccessUnit(unit: UnitDTO, viewer: ViewerRef): boolean {
  if (unit.status === UnitStatus.DELETED) return false;

  const ownerUserId = unit.user?.unitId ?? unit.userId ?? null;
  const viewerUserId = viewer?.unitId ?? null;
  const isOwner = !!ownerUserId && ownerUserId === viewerUserId;

  if (unit.status === UnitStatus.DRAFT) return isOwner;
  if (
    unit.visibility === UnitVisibility.PRIVATE ||
    unit.visibility === UnitVisibility.UNLISTED
  ) {
    return isOwner;
  }
  return true;
}
