import type { UnitDTO } from "@rezics/contract";

export type ViewerRef = { unitId?: string | null } | null | undefined;

export function canAccessUnit(unit: UnitDTO, viewer: ViewerRef): boolean {
  if (unit.status === "DELETED") return false;

  const ownerUnitId = unit.user?.unitId ?? null;
  const viewerUnitId = viewer?.unitId ?? null;
  const isOwner = !!ownerUnitId && ownerUnitId === viewerUnitId;

  if (unit.status === "DRAFT") return isOwner;
  if (unit.visibility === "PRIVATE" || unit.visibility === "UNLISTED") {
    return isOwner;
  }
  return true;
}
