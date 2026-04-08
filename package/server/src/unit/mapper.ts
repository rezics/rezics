import type { UnitDTO } from "@rezics/contract";
import { sanitizeUser } from "@/utils/sanitizeUser";
import type { UnitWithRelations } from "./types";

/**
 * Map internal Unit model to UnitDTO
 */
export function mapUnitToDTO(unit: UnitWithRelations): UnitDTO {
  return {
    id: unit.id,
    userId: unit.userId,
    user: sanitizeUser(unit.user),
    type: unit.type,
    status: unit.status,
    title: unit.title ?? undefined,
    content: unit.content ?? undefined,
    metadata: (unit.metadata as any) ?? undefined,
    targetUnitId: unit.targetUnitId ?? undefined,
    createdAt: unit.createdAt,
    updatedAt: unit.updatedAt,
    tags: unit.tags?.map((t) => t.name) ?? [],
    reactionSummaries: unit.reactionSummaries,
  } as UnitDTO;
}
