import { describe, expect, test } from "bun:test";
import {
  resolveBookCommunityFeedQuery,
  resolvePostTargetReleaseLabel,
} from "./communityFeed";

describe("book community feed helpers", () => {
  test("uses the current catalog entry as the feed target", () => {
    expect(
      resolveBookCommunityFeedQuery({
        currentReleaseUnitId: "release-1",
      }),
    ).toEqual({ mode: "entry", targetUnitId: "release-1" });
  });

  test("labels sibling-release posts without labelling current-release posts", () => {
    const titles = { "release-2": "Translated Edition" };

    expect(
      resolvePostTargetReleaseLabel(
        { targetUnitId: "release-2" },
        "release-1",
        titles,
      ),
    ).toBe("Translated Edition");
    expect(
      resolvePostTargetReleaseLabel(
        { targetUnitId: "release-1" },
        "release-1",
        titles,
      ),
    ).toBeUndefined();
  });
});
