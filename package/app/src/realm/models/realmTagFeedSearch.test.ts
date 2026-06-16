import { describe, expect, it } from "bun:test";
import { realmFeedSearchForSingleTag } from "./realmTagFeedSearch";

describe("realm tag feed search", () => {
  it("replaces the feed filter with exactly the selected tag", () => {
    expect(
      realmFeedSearchForSingleTag(
        { sort: "best", tags: "old-a,old-b" },
        "tag-new",
      ),
    ).toEqual({
      sort: "best",
      tags: "tag-new",
    });
  });

  it("preserves the current sort while selecting a tag", () => {
    expect(realmFeedSearchForSingleTag({ sort: "hot" }, "tag-a")).toEqual({
      sort: "hot",
      tags: "tag-a",
    });
  });
});
