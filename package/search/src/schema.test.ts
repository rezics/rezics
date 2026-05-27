import { describe, expect, test } from "bun:test";
import { getExpectedMeiliIndexSchema } from "./schema";

describe("expected Meilisearch work-domain settings", () => {
  test("content index exposes work-domain filter fields", () => {
    const content = getExpectedMeiliIndexSchema("content");

    expect(content.filterableAttributes).toEqual(
      expect.arrayContaining([
        "workUnitId",
        "searchGroupId",
        "ownTagIds",
        "workTagIds",
        "allTagIds",
        "displayPolicy",
        "position",
        "workUnitIds",
        "workRoles",
        "seriesUnitIds",
        "seriesKindKeys",
        "aiDisclosureMode",
      ]),
    );
  });

  test("post index exposes UnitWork membership fields", () => {
    const posts = getExpectedMeiliIndexSchema("posts");

    expect(posts.filterableAttributes).toEqual(
      expect.arrayContaining(["workUnitIds", "workRoles"]),
    );
  });
});
