import type { ShelfItemDTO, ShelfItemType } from "./shelf";

type ShelfItemIdentityParts = Pick<ShelfItemDTO, "itemType" | "itemId">;

export function shelfItemIdentity(item: ShelfItemIdentityParts): string {
  return `${item.itemType}:${item.itemId}`;
}

export function shelfItemIdentityFromParts(
  itemType: ShelfItemType,
  itemId: string,
): string {
  return `${itemType}:${itemId}`;
}

export function shelfItemUnitId(item: ShelfItemIdentityParts): string | null {
  return item.itemType === "unit" ? item.itemId : null;
}

export function shelfItemReference(item: ShelfItemIdentityParts): string {
  return item.itemId;
}
