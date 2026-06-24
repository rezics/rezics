import type {
  UserShelfItemDTO,
  UserShelfItemMetadataDTO,
} from "@rezics/contract";
import type {
  UserShelfItemMetadataRow,
  UserShelfItemRow,
} from "./user-shelf-item.types";

export function mapUserShelfItemMetadataToDTO(
  row: UserShelfItemMetadataRow,
): UserShelfItemMetadataDTO {
  return {
    userId: row.userId,
    unitId: row.unitId,
    searchText: row.searchText,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapUserShelfItemToDTO(row: UserShelfItemRow): UserShelfItemDTO {
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
