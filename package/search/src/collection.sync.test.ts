import { describe, expect, mock, test } from "bun:test";
import {
  removeUserUnitCollection,
  setSearchPrismaClient,
  syncSingleUserUnitCollection,
  syncUserUnitCollectionSegment,
} from "./sync";

describe("user unit collection search sync", () => {
  test("syncs one collection row or removes a missing row", async () => {
    const addOrUpdateCollections = mock(async () => ({}));
    const deleteCollections = mock(async () => ({}));
    const findUnique = mock(async () => ({
      userId: "user-1",
      unitId: "unit-1",
      searchText: "private alias",
      createdAt: new Date("2026-05-31T00:00:00.000Z"),
      updatedAt: new Date("2026-05-31T00:01:00.000Z"),
    }));
    setSearchPrismaClient({
      userUnitCollection: { findUnique },
    } as any);

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

    findUnique.mockImplementationOnce(async () => null);
    await syncSingleUserUnitCollection(
      { addOrUpdateCollections, deleteCollections } as any,
      "user-1",
      "missing",
    );

    expect(deleteCollections).toHaveBeenCalledWith(["user-1:missing"]);
  });

  test("syncs collection segments with composite cursors", async () => {
    const addOrUpdateCollections = mock(async () => ({}));
    const findMany = mock(async () => [
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
    ]);
    setSearchPrismaClient({
      userUnitCollection: { findMany },
    } as any);

    const result = await syncUserUnitCollectionSegment(
      { addOrUpdateCollections } as any,
      { limit: 1, cursor: "user-0:unit-9" },
    );

    expect(findMany).toHaveBeenCalledWith({
      orderBy: [{ userId: "asc" }, { unitId: "asc" }],
      take: 2,
      skip: 1,
      cursor: {
        userId_unitId: {
          userId: "user-0",
          unitId: "unit-9",
        },
      },
    });
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
