import { describe, expect, test } from "bun:test";
import { getExpectedMeiliIndexSchema } from "./schema";
import {
  buildShelfItemDocument,
  SHELF_ITEM_INDEX_NAME,
  shelfItemDocumentId,
} from "./shelf-item";

describe("expected Meilisearch index settings", () => {
  test("content index exposes catalog and media filter fields", () => {
    const content = getExpectedMeiliIndexSchema("content");

    expect(content.filterableAttributes).toEqual(
      expect.arrayContaining([
        "seriesUnitIds",
        "seriesKindKeys",
        "platformEntityIds",
        "ratingTagUnitIds",
        "mediaKindKey",
        "mediaContentStructureAvailable",
        "aiDisclosureMode",
      ]),
    );
    expect(content.sortableAttributes).toEqual(
      expect.arrayContaining([
        "gameReleaseDate",
        "mediaReleaseDate",
        "mediaRuntimeMinutes",
      ]),
    );
  });

  test("post index exposes root post filters only", () => {
    const posts = getExpectedMeiliIndexSchema("posts");

    expect(posts.filterableAttributes).toEqual(
      expect.arrayContaining([
        "kind",
        "targetUnitId",
        "variantUnitId",
        "realmIds",
      ]),
    );
    expect(posts.filterableAttributes).not.toContain("parentPostUnitId");
  });

  test("comment index is partitioned by root unit and realm", () => {
    const comments = getExpectedMeiliIndexSchema("comments");

    expect(comments.filterableAttributes).toEqual(
      expect.arrayContaining(["rootUnitId", "realmUnitId", "parentCommentId"]),
    );
    expect(comments.searchableAttributes).toEqual(
      expect.arrayContaining(["contentText", "authorName"]),
    );
  });

  test("shelf item index supports grouped shelf search", () => {
    const shelfItems = getExpectedMeiliIndexSchema(SHELF_ITEM_INDEX_NAME);

    expect(shelfItems.searchableAttributes).toEqual(
      expect.arrayContaining([
        "itemTitle",
        "itemSummary",
        "itemText",
        "searchText",
        "shelfTitle",
      ]),
    );
    expect(shelfItems.filterableAttributes).toEqual(
      expect.arrayContaining([
        "shelfId",
        "shelfOwnerUserId",
        "shelfVisibility",
        "itemType",
        "rootItemId",
        "parentRole",
      ]),
    );
    expect(shelfItems.sortableAttributes).toEqual(
      expect.arrayContaining(["position", "createdAt", "updatedAt"]),
    );
  });

  test("feedback index exposes polymorphic target filters", () => {
    const feedbacks = getExpectedMeiliIndexSchema("feedbacks");

    expect(feedbacks.filterableAttributes).toEqual(
      expect.arrayContaining(["targetKind", "targetId", "addressedUnitId"]),
    );
    expect(feedbacks.filterableAttributes).not.toContain("unitId");
  });

  test("poll index supports library usage and lifecycle filters", () => {
    const polls = getExpectedMeiliIndexSchema("polls");

    expect(polls.searchableAttributes).toEqual(
      expect.arrayContaining(["titles", "descriptions", "optionLabels"]),
    );
    expect(polls.filterableAttributes).toEqual(
      expect.arrayContaining(["ownerUserId", "used", "closed", "languages"]),
    );
    expect(polls.sortableAttributes).toEqual(
      expect.arrayContaining(["usageCount", "createdAt", "updatedAt"]),
    );
  });
});

describe("shelf item search documents", () => {
  test("use stable shelf-scoped ids and normalized timestamps", () => {
    expect(
      shelfItemDocumentId({
        shelfId: "shelf-1",
        itemType: "unit",
        itemId: "unit-1",
      }),
    ).toBe("shelf-1:unit:unit-1");

    expect(
      buildShelfItemDocument({
        shelfId: "shelf-1",
        shelfOwnerUserId: "user-1",
        shelfVisibility: "public",
        shelfStatus: "active",
        itemType: "unit",
        itemId: "unit-1",
        searchText: "note",
        createdAt: new Date("2026-06-05T00:00:00Z"),
        updatedAt: new Date("2026-06-05T00:00:01Z"),
      }),
    ).toMatchObject({
      id: "shelf-1:unit:unit-1",
      kind: "root",
      rootItemType: "unit",
      rootItemId: "unit-1",
      createdAt: 1_780_617_600,
      position: "",
      updatedAt: 1_780_617_601,
    });
  });

  test("preserves comment context fields for comment-backed shelf items", () => {
    expect(
      buildShelfItemDocument({
        shelfId: "shelf-1",
        shelfOwnerUserId: "user-1",
        shelfVisibility: "PUBLIC",
        shelfStatus: "PUBLISHED",
        shelfTitle: "Comment saves",
        itemType: "comment",
        itemId: "comment-1",
        kind: "comment",
        rootItemType: "unit",
        rootItemId: "book-1",
        parentItemType: "unit",
        parentItemId: "book-1",
        parentRole: "comment",
        itemText: "Saved reply body",
        rootUnitId: "book-1",
        realmUnitId: "realm-1",
        parentCommentId: "comment-parent",
        authorUserId: "author-1",
        authorName: "Reviewer",
        moderationStatus: "APPROVED",
        isLocked: false,
        deletedAt: null,
        createdAt: "2026-06-05T00:00:00.000Z",
        updatedAt: "2026-06-05T00:00:01.000Z",
      }),
    ).toMatchObject({
      id: "shelf-1:comment:comment-1",
      itemType: "comment",
      itemId: "comment-1",
      kind: "comment",
      rootItemType: "unit",
      rootItemId: "book-1",
      parentItemType: "unit",
      parentItemId: "book-1",
      parentRole: "comment",
      itemText: "Saved reply body",
      rootUnitId: "book-1",
      realmUnitId: "realm-1",
      parentCommentId: "comment-parent",
      authorUserId: "author-1",
      authorName: "Reviewer",
      moderationStatus: "APPROVED",
      isLocked: false,
      deletedAt: null,
    });
  });
});
