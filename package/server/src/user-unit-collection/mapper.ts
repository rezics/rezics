import type {
  CollectionUnitDTO,
  UserUnitCollectionDTO,
} from "@rezics/contract";
import type { CollectionUnitRow, UserUnitCollectionRow } from "./types";

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

export function mapCollectionUnitToDTO(
  row: CollectionUnitRow,
): CollectionUnitDTO {
  return {
    userId: row.userId,
    unitId: row.unitId,
    shelfIds: row.shelfIds,
    tagUnitIds: row.tagUnitIds,
    searchText: row.searchText,
    createdAt: row.createdAt ?? undefined,
    updatedAt: row.updatedAt ?? undefined,
  };
}
