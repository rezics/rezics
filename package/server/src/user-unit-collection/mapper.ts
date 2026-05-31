import type { UserUnitCollectionDTO } from "@rezics/contract";
import type { UserUnitCollectionRow } from "./types";

export function mapUserUnitCollectionToDTO(
  row: UserUnitCollectionRow,
): UserUnitCollectionDTO {
  return {
    userId: row.userId,
    unitId: row.unitId,
    searchText: row.searchText,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
