import { describe, expect, test } from "bun:test";
import { toContentSearchOptions } from "./toContentSearchOptions";

describe("toContentSearchOptions", () => {
  test("maps game platform ids to content search platform filters", () => {
    expect(
      toContentSearchOptions({
        platformEntityIds: ["platform-steam", "platform-steam", "platform-pc"],
      }),
    ).toMatchObject({
      platformEntityIds: ["platform-steam", "platform-pc"],
    });
  });

  test("routes external age ratings through tag filters", () => {
    expect(
      toContentSearchOptions({
        tags: [{ slug: "rpg" }],
        ageRatingTagUnitIds: ["tag-esrb-teen"],
      }),
    ).toMatchObject({
      tags: [{ slug: "rpg" }, { unitId: "tag-esrb-teen" }],
    });
  });
});
