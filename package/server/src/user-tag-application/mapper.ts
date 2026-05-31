import type { UserTagApplicationDTO } from "@rezics/contract";
import type { UserTagApplicationRow } from "./types";

export function mapUserTagApplicationToDTO(
  row: UserTagApplicationRow,
): UserTagApplicationDTO {
  return {
    userId: row.userId,
    unitId: row.unitId,
    tagUnitId: row.tagUnitId,
    position: row.position,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
