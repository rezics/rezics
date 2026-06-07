import { describe, expect, it } from "bun:test";
import {
  realmFeedSearchForSingleTag,
  realmTagsTabSearch,
} from "./realmTagFeedSearch";

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

  it("opens the full tag tab without changing feed filters", () => {
    expect(
      realmTagsTabSearch({ tab: "feed", sort: "hot", tags: "tag-a,tag-b" }),
    ).toEqual({
      tab: "tags",
      sort: "hot",
      tags: "tag-a,tag-b",
    });
  });
});
