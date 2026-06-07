import { describe, expect, it } from "bun:test";
import { realmFeedSearchForSingleTag } from "./realmTagFeedSearch";

describe("realm tag feed search", () => {
  it("enters feed with exactly the selected tag", () => {
    expect(
      realmFeedSearchForSingleTag(
        { tab: "tags", sort: "best", tags: "old-a,old-b" },
        "tag-new",
      ),
    ).toEqual({
      tab: "feed",
      sort: "best",
      tags: "tag-new",
    });
  });
});
