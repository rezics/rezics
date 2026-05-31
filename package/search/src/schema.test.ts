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

  test("post index omits reply and legacy work fields", () => {
    const posts = getExpectedMeiliIndexSchema("posts");

    expect(posts.filterableAttributes).toEqual(
      expect.arrayContaining(["kind", "targetUnitId", "realmIds"]),
    );
    expect(posts.filterableAttributes).not.toContain("workUnitIds");
    expect(posts.filterableAttributes).not.toContain("workRoles");
    expect(posts.filterableAttributes).not.toContain("parentPostUnitId");
  });

  test("comment index is partitioned by root unit and realm", () => {
    const comments = getExpectedMeiliIndexSchema("comments");

    expect(comments.filterableAttributes).toEqual(
      expect.arrayContaining([
        "rootUnitId",
        "realmUnitId",
        "parentCommentUnitId",
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
});
