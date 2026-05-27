import type { UnitWorkDTO } from "@rezics/contract";
import type { UnitWork } from "#/prisma/client";

export function mapUnitWorkToDTO(row: UnitWork): UnitWorkDTO {
  return {
    unitId: row.unitId,
    workUnitId: row.workUnitId,
    role: row.role,
    language: row.language,
    position: row.position,
    displayPolicy: row.displayPolicy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
