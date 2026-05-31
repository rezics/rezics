export const COLLECTION_INDEX_NAME = "user_unit_collections";

export interface UserUnitCollectionRow {
  userId: string;
  unitId: string;
  searchText: string | null;
  createdAt: Date | string | number;
  updatedAt: Date | string | number;
}

export interface UserUnitCollectionDocument {
  id: string;
  ownerUserId: string;
  unitId: string;
  searchText: string | null;
  createdAt: number;
  updatedAt: number;
}

export function collectionDocumentId(userId: string, unitId: string): string {
  return `${userId}:${unitId}`;
}

export function toUnixSeconds(value: Date | string | number): number {
  if (value instanceof Date) {
    return Math.floor(value.getTime() / 1000);
  }

  if (typeof value === "number") {
    return Math.floor(value / 1000);
  }

  return Math.floor(new Date(value).getTime() / 1000);
}

export function buildUserUnitCollectionDocument(
  row: UserUnitCollectionRow,
): UserUnitCollectionDocument {
  return {
    id: collectionDocumentId(row.userId, row.unitId),
    ownerUserId: row.userId,
    unitId: row.unitId,
    searchText: row.searchText,
    createdAt: toUnixSeconds(row.createdAt),
    updatedAt: toUnixSeconds(row.updatedAt),
  };
}
