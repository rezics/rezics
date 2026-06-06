import { describe, expect, test } from "bun:test";
import type { ShelfItemShelfGroup } from "@rezics/contract";
import { shelfMatchedSource } from "../models/shelfMatchedSource";

function group(matches: ShelfItemShelfGroup["matches"]): ShelfItemShelfGroup {
  return {
    shelfId: "shelf-1",
    shelfTitle: "Shelf",
    shelfOwnerUserId: "user-1",
    shelfVisibility: "PUBLIC",
    total: matches.length,
    matches,
  };
}

describe("shelfMatchedSource", () => {
  test("summarizes grouped shelf item matches for shelf result cards", () => {
    const source = shelfMatchedSource(
      group([
        {
          item: {
            id: "shelf-1:unit:book-1",
            shelfId: "shelf-1",
            shelfOwnerUserId: "user-1",
            shelfVisibility: "PUBLIC",
            shelfStatus: "PUBLISHED",
            shelfTitle: "Shelf",
            itemType: "unit",
            itemId: "book-1",
            kind: "book",
            rootItemType: "unit",
            rootItemId: "book-1",
            parentItemType: null,
            parentItemId: null,
            parentRole: null,
            position: "a0",
            itemTitle: "Matched Book",
            itemSummary: null,
            itemText: null,
            searchText: null,
            rootUnitId: "book-1",
            realmUnitId: null,
            parentCommentId: null,
            authorUserId: null,
            authorName: null,
            moderationStatus: null,
            isLocked: null,
            deletedAt: null,
            createdAt: 1,
            updatedAt: 2,
          },
        },
      ]),
    );

    expect(source).toBe("Matched Book");
  });
});
