import type { ShelfItemSearchDocument } from "@rezics/contract/meili";

export const SHELF_ITEM_INDEX_NAME = "shelf_items";

function toUnixSeconds(value: Date | string | number): number {
  return Math.floor(new Date(value).getTime() / 1000);
}

export interface ShelfItemDocumentRow {
  shelfId: string;
  shelfOwnerUserId: string;
  shelfVisibility: string;
  shelfStatus: string;
  shelfTitle?: string | null;
  itemType: string;
  itemId: string;
  kind?: string | null;
  rootItemType?: string | null;
  rootItemId?: string | null;
  parentItemType?: string | null;
  parentItemId?: string | null;
  parentRole?: string | null;
  position?: string | null;
  itemTitle?: string | null;
  itemSummary?: string | null;
  itemText?: string | null;
  searchText?: string | null;
  rootUnitId?: string | null;
  realmUnitId?: string | null;
  parentCommentId?: string | null;
  authorUserId?: string | null;
  authorName?: string | null;
  moderationStatus?: string | null;
  isLocked?: boolean | null;
  deletedAt?: Date | string | number | null;
  createdAt: Date | string | number;
  updatedAt: Date | string | number;
}

export function shelfItemDocumentId(input: {
  shelfId: string;
  itemType: string;
  itemId: string;
}): string {
  return `${input.shelfId}:${input.itemType}:${input.itemId}`;
}

export function buildShelfItemDocument(
  row: ShelfItemDocumentRow,
): ShelfItemSearchDocument {
  const parentItemId = row.parentItemId ?? null;
  const kind = row.kind ?? (parentItemId ? "child" : "root");

  return {
    id: shelfItemDocumentId(row),
    shelfId: row.shelfId,
    shelfOwnerUserId: row.shelfOwnerUserId,
    shelfVisibility: row.shelfVisibility,
    shelfStatus: row.shelfStatus,
    shelfTitle: row.shelfTitle ?? null,
    itemType: row.itemType,
    itemId: row.itemId,
    kind,
    rootItemType: row.rootItemType ?? row.itemType,
    rootItemId: row.rootItemId ?? row.itemId,
    parentItemType: row.parentItemType ?? null,
    parentItemId,
    parentRole: row.parentRole ?? null,
    position: row.position ?? "",
    itemTitle: row.itemTitle ?? null,
    itemSummary: row.itemSummary ?? null,
    itemText: row.itemText ?? null,
    searchText: row.searchText ?? null,
    rootUnitId: row.rootUnitId ?? null,
    realmUnitId: row.realmUnitId ?? null,
    parentCommentId: row.parentCommentId ?? null,
    authorUserId: row.authorUserId ?? null,
    authorName: row.authorName ?? null,
    moderationStatus: row.moderationStatus ?? null,
    isLocked: row.isLocked ?? null,
    deletedAt:
      row.deletedAt === null || row.deletedAt === undefined
        ? null
        : new Date(row.deletedAt).toISOString(),
    createdAt: toUnixSeconds(row.createdAt),
    updatedAt: toUnixSeconds(row.updatedAt),
  };
}
