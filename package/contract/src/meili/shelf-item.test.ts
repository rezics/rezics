import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import {
  ShelfItemSearchDocumentSchema,
  ShelfItemSearchOptionsSchema,
  ShelfItemSearchResultSchema,
} from "./shelf-item";

describe("ShelfItemSearchDocumentSchema", () => {
  test("accepts denormalized shelf item records", () => {
    const document = {
      id: "shelf-1:unit:unit-1",
      shelfId: "shelf-1",
      shelfOwnerUserId: "user-1",
      shelfVisibility: "public",
      shelfStatus: "active",
      shelfTitle: "Summer reading",
      itemType: "unit",
      itemId: "unit-1",
      kind: "root",
      rootItemType: "unit",
      rootItemId: "unit-1",
      parentItemType: null,
      parentItemId: null,
      parentRole: null,
      position: "a0",
      itemTitle: "Book title",
      itemSummary: "Short summary",
      itemText: null,
      searchText: "private note",
      rootUnitId: "unit-1",
      realmUnitId: null,
      parentCommentId: null,
      authorUserId: null,
      authorName: null,
      moderationStatus: null,
      isLocked: null,
      deletedAt: null,
      createdAt: 1_783_000_000,
      updatedAt: 1_783_000_100,
    };

    expect(Value.Check(ShelfItemSearchDocumentSchema, document)).toBe(true);
  });

  test("accepts grouped search results", () => {
    const item = {
      id: "shelf-1:comment:comment-1",
      shelfId: "shelf-1",
      shelfOwnerUserId: "user-1",
      shelfVisibility: "private",
      shelfStatus: "active",
      shelfTitle: null,
      itemType: "comment",
      itemId: "comment-1",
      kind: "child",
      rootItemType: "unit",
      rootItemId: "unit-1",
      parentItemType: "unit",
      parentItemId: "unit-1",
      parentRole: "comment",
      position: "a1",
      itemTitle: null,
      itemSummary: null,
      itemText: "quoted comment",
      searchText: null,
      rootUnitId: "unit-1",
      realmUnitId: "realm-1",
      parentCommentId: null,
      authorUserId: "user-2",
      authorName: "Author",
      moderationStatus: "visible",
      isLocked: false,
      deletedAt: null,
      createdAt: 1,
      updatedAt: 2,
    };

    expect(
      Value.Check(ShelfItemSearchResultSchema, {
        items: [item],
        groups: [
          {
            shelfId: "shelf-1",
            shelfTitle: null,
            shelfOwnerUserId: "user-1",
            shelfVisibility: "private",
            total: 1,
            matches: [{ item, score: 0.9 }],
          },
        ],
        total: 1,
        processingTimeMs: 3,
        query: "quoted",
      }),
    ).toBe(true);
  });
});

describe("ShelfItemSearchOptionsSchema", () => {
  test("supports shelf grouping filters and stable sorts", () => {
    expect(
      Value.Check(ShelfItemSearchOptionsSchema, {
        keyword: "note",
        shelfIds: ["shelf-1", "shelf-2"],
        itemType: "unit",
        parentRole: null,
        includePrivateSearchText: true,
        sort: { field: "position", order: "asc" },
        limit: 20,
      }),
    ).toBe(true);
  });
});
