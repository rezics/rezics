import type { UnitDTO } from "@rezics/contract";

export type ViewerRef = { unitId?: string | null } | null | undefined;

export function canAccessUnit(unit: UnitDTO, viewer: ViewerRef): boolean {
  if (unit.status === "DELETED") return false;

  const ownerUserId = unit.user?.unitId ?? unit.userId ?? null;
  const viewerUserId = viewer?.unitId ?? null;
  const isOwner = !!ownerUserId && ownerUserId === viewerUserId;

  if (unit.status === "DRAFT") return isOwner;
  if (unit.visibility === "PRIVATE" || unit.visibility === "UNLISTED") {
    return isOwner;
  }
  return true;
}
