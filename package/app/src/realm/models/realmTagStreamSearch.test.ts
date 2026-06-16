import { describe, expect, it } from "bun:test";
import { realmStreamSearchForSingleTag } from "./realmTagStreamSearch";

describe("realm tag stream search", () => {
  it("replaces the stream filter with exactly the selected tag", () => {
    expect(
      realmStreamSearchForSingleTag(
        { sort: "best", tags: "old-a,old-b" },
        "tag-new",
      ),
    ).toEqual({
      sort: "best",
      tags: "tag-new",
    });
  });

  it("preserves the current sort while selecting a tag", () => {
    expect(realmStreamSearchForSingleTag({ sort: "hot" }, "tag-a")).toEqual({
      sort: "hot",
      tags: "tag-a",
    });
  });
});
