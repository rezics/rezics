import { describe, expect, test } from "bun:test";
import { getExpectedMeiliIndexSchema } from "./schema";

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
      expect.arrayContaining([
        "rootUnitId",
        "realmUnitId",
        "parentCommentId",
      ]),
    );
    expect(comments.searchableAttributes).toEqual(
      expect.arrayContaining(["contentText", "authorName"]),
    );
  });

  test("collection index stores only collection-side metadata", () => {
    const collection = getExpectedMeiliIndexSchema("user_unit_collections");

    expect(collection.searchableAttributes).toEqual(["searchText"]);
    expect(collection.filterableAttributes).toEqual(
      expect.arrayContaining(["ownerUserId", "unitId"]),
    );
    expect(collection.filterableAttributes).not.toContain("titles");
    expect(collection.filterableAttributes).not.toContain("tagUnitIds");
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
