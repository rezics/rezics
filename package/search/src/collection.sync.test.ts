import { describe, expect, mock, test } from "bun:test";
import {
  removeUserUnitCollection,
  setSearchDb,
  syncSingleUserUnitCollection,
  syncUserUnitCollectionSegment,
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

describe("user unit collection search sync", () => {
  test("syncs one collection row or removes a missing row", async () => {
    const addOrUpdateCollections = mock(async () => ({}));
    const deleteCollections = mock(async () => ({}));
    setSearchDb(
      createDb([
        [
          {
            userId: "user-1",
            unitId: "unit-1",
            searchText: "private alias",
            createdAt: new Date("2026-05-31T00:00:00.000Z"),
            updatedAt: new Date("2026-05-31T00:01:00.000Z"),
          },
        ],
        [],
      ]) as never,
    );

    await syncSingleUserUnitCollection(
      { addOrUpdateCollections, deleteCollections } as any,
      "user-1",
      "unit-1",
    );

    expect(addOrUpdateCollections).toHaveBeenCalledWith([
      {
        id: "user-1:unit-1",
        ownerUserId: "user-1",
        unitId: "unit-1",
        searchText: "private alias",
        createdAt: 1780185600,
        updatedAt: 1780185660,
      },
    ]);

    await syncSingleUserUnitCollection(
      { addOrUpdateCollections, deleteCollections } as any,
      "user-1",
      "missing",
    );

    expect(deleteCollections).toHaveBeenCalledWith(["user-1:missing"]);
  });

  test("syncs collection segments with composite cursors", async () => {
    const addOrUpdateCollections = mock(async () => ({}));
    setSearchDb(
      createDb([
        [
          {
            userId: "user-1",
            unitId: "unit-1",
            searchText: null,
            createdAt: new Date("2026-05-31T00:00:00.000Z"),
            updatedAt: new Date("2026-05-31T00:00:00.000Z"),
          },
          {
            userId: "user-1",
            unitId: "unit-2",
            searchText: "note",
            createdAt: new Date("2026-05-31T00:00:00.000Z"),
            updatedAt: new Date("2026-05-31T00:00:00.000Z"),
          },
        ],
      ]) as never,
    );

    const result = await syncUserUnitCollectionSegment(
      { addOrUpdateCollections } as any,
      { limit: 1, cursor: "user-0:unit-9" },
    );

    expect(result).toEqual({ processed: 1, nextCursor: "user-1:unit-1" });
    expect(addOrUpdateCollections).toHaveBeenCalledTimes(1);
  });

  test("removes one collection document", async () => {
    const deleteCollections = mock(async () => ({}));
    await removeUserUnitCollection(
      { deleteCollections } as any,
      "user-1",
      "unit-1",
    );
    expect(deleteCollections).toHaveBeenCalledWith(["user-1:unit-1"]);
  });
});
