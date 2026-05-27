import { describe, expect, test } from "bun:test";
import {
  resolveBookCommunityFeedQuery,
  resolvePostTargetReleaseLabel,
} from "./communityFeed";

describe("book community feed helpers", () => {
  test("defaults release-aware books to a work-domain feed", () => {
    expect(
      resolveBookCommunityFeedQuery({
        currentReleaseUnitId: "release-1",
        workUnitId: "work-1",
        exactRelease: false,
      }),
    ).toEqual({
      mode: "work",
      workUnitId: "work-1",
      workRoles: ["POST", "REVIEW"],
    });
  });

  test("uses exact release filtering when requested or no work exists", () => {
    expect(
      resolveBookCommunityFeedQuery({
        currentReleaseUnitId: "release-1",
        workUnitId: "work-1",
        exactRelease: true,
      }),
    ).toEqual({ mode: "release", targetUnitId: "release-1" });

    expect(
      resolveBookCommunityFeedQuery({
        currentReleaseUnitId: "standalone-1",
        workUnitId: null,
        exactRelease: false,
      }),
    ).toEqual({ mode: "release", targetUnitId: "standalone-1" });
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
