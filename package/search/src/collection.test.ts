import { describe, expect, test } from "bun:test";
import {
  buildUserUnitCollectionDocument,
  collectionDocumentId,
} from "./collection";

describe("user unit collection search document", () => {
  test("stores only collection-side metadata", () => {
    const doc = buildUserUnitCollectionDocument({
      userId: "user-1",
      unitId: "book-1",
      searchText: "private alias",
      createdAt: "2026-05-31T00:00:00.000Z",
      updatedAt: "2026-05-31T00:01:00.000Z",
    });

    expect(doc).toEqual({
      id: collectionDocumentId("user-1", "book-1"),
      ownerUserId: "user-1",
      unitId: "book-1",
      searchText: "private alias",
      createdAt: 1780185600,
      updatedAt: 1780185660,
    });
    expect(Object.keys(doc).sort()).toEqual([
      "createdAt",
      "id",
      "ownerUserId",
      "searchText",
      "unitId",
      "updatedAt",
    ]);
  });
});
