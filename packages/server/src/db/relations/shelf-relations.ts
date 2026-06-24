import type { ServerRelationsBuilder } from "./types";

export function shelfRelations(r: ServerRelationsBuilder) {
  return {
    Shelf: {
      Unit: r.one.Unit({
        from: r.Shelf.unitId,
        to: r.Unit.id,
      }),
      ShelfItems: r.many.ShelfItem(),
    },
    ShelfItem: {
      Shelf: r.one.Shelf({
        from: r.ShelfItem.shelfId,
        to: r.Shelf.unitId,
      }),
      ParentShelfItem: r.one.ShelfItem({
        from: [
          r.ShelfItem.shelfId,
          r.ShelfItem.parentItemType,
          r.ShelfItem.parentItemId,
        ],
        to: [r.ShelfItem.shelfId, r.ShelfItem.itemType, r.ShelfItem.itemId],
        alias: "ShelfItem_parent",
      }),
    },
  };
}
