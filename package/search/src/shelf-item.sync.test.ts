import { describe, expect, mock, test } from "bun:test";
import {
  removeShelfItem,
  setSearchDb,
  syncShelfItemSegment,
  syncShelfItemsBySourceItemSegment,
  syncSingleShelfItem,
} from "./sync";

function createDb(rowSets: unknown[][]) {
  const createChain = () => ({
    where() {
      return createChain();
    },
    orderBy() {
      return createChain();
    },
    async limit() {
      return rowSets.shift() ?? [];
    },
  });

  return {
    select() {
      return {
        from() {
          return createChain();
        },
      };
    },
  };
}

function shelfItemRow(overrides: Record<string, unknown> = {}) {
  return {
    shelfId: "shelf-1",
    shelfOwnerUserId: "user-1",
    shelfVisibility: "PUBLIC",
    shelfStatus: "PUBLISHED",
    shelfTitle: "Reading list",
    itemType: "unit",
    unitId: "unit-1",
    kind: "root",
    parentItemType: null,
    parentUnitId: null,
    parentRole: null,
    position: "a0",
    searchText: "private alias",
    createdByUserId: "user-1",
    createdAt: new Date("2026-05-31T00:00:00.000Z"),
    updatedAt: new Date("2026-05-31T00:01:00.000Z"),
    itemTitle: "Book title",
    itemSummary: "Summary",
    itemText: null,
    rootUnitId: "unit-1",
    realmUnitId: null,
    parentCommentId: null,
    authorUserId: "user-1",
    authorName: "Owner",
    moderationStatus: "APPROVED",
    isLocked: null,
    deletedAt: null,
    ...overrides,
  };
}

describe("shelf item search sync", () => {
  test("syncs one shelf item or removes a missing row", async () => {
    const addOrUpdateShelfItems = mock(async () => ({}));
    const deleteShelfItems = mock(async () => ({}));
    setSearchDb(createDb([[shelfItemRow()], []]) as never);

    await syncSingleShelfItem(
      { addOrUpdateShelfItems, deleteShelfItems } as any,
      "shelf-1",
      "unit",
      "unit-1",
    );

    expect(addOrUpdateShelfItems).toHaveBeenCalledWith([
      expect.objectContaining({
        id: "shelf-1:unit:unit-1",
        shelfId: "shelf-1",
        shelfOwnerUserId: "user-1",
        itemType: "unit",
        itemId: "unit-1",
        itemTitle: "Book title",
        searchText: "private alias",
        position: "a0",
        createdAt: 1780185600,
        updatedAt: 1780185660,
      }),
    ]);

    await syncSingleShelfItem(
      { addOrUpdateShelfItems, deleteShelfItems } as any,
      "shelf-1",
      "unit",
      "missing",
    );

    expect(deleteShelfItems).toHaveBeenCalledWith(["shelf-1:unit:missing"]);
  });

  test("syncs full and source-filtered segments with composite cursors", async () => {
    const addOrUpdateShelfItems = mock(async () => ({}));
    setSearchDb(
      createDb([
        [
          shelfItemRow(),
          shelfItemRow({
            shelfId: "shelf-2",
            unitId: "unit-2",
            position: "a1",
          }),
        ],
        [
          shelfItemRow({
            shelfId: "shelf-3",
            itemType: "comment",
            unitId: "comment-1",
            position: "b0",
          }),
        ],
      ]) as never,
    );

    const segment = await syncShelfItemSegment(
      { addOrUpdateShelfItems } as any,
      { limit: 1, cursor: "shelf-0:unit:unit-0" },
    );
    const sourceSegment = await syncShelfItemsBySourceItemSegment(
      { addOrUpdateShelfItems } as any,
      "comment",
      "comment-1",
      { limit: 10 },
    );

    expect(segment).toEqual({
      processed: 1,
      nextCursor: "shelf-1:unit:unit-1",
    });
    expect(sourceSegment).toEqual({ processed: 1 });
    expect(addOrUpdateShelfItems).toHaveBeenCalledTimes(2);
  });

  test("removes one shelf item document", async () => {
    const deleteShelfItems = mock(async () => ({}));
    await removeShelfItem(
      { deleteShelfItems } as any,
      "shelf-1",
      "unit",
      "unit-1",
    );
    expect(deleteShelfItems).toHaveBeenCalledWith(["shelf-1:unit:unit-1"]);
  });
});
