import { describe, expect, test } from "bun:test";
import {
  resolveTagVoteClickAction,
  tagSearchTarget,
} from "./tagVoteInteraction";

describe("tag vote interaction helpers", () => {
  test("clicking the active vote withdraws it", () => {
    expect(resolveTagVoteClickAction(1, 1)).toEqual({ kind: "withdraw" });
    expect(resolveTagVoteClickAction(-1, -1)).toEqual({ kind: "withdraw" });
  });

  test("clicking another vote casts that vote", () => {
    expect(resolveTagVoteClickAction(null, 1)).toEqual({
      kind: "vote",
      value: 1,
    });
    expect(resolveTagVoteClickAction(1, -1)).toEqual({
      kind: "vote",
      value: -1,
    });
  });

  test("builds the injected search target from translated tag data", () => {
    expect(
      tagSearchTarget(
        "tag-1",
        {
          "tag-1": {
            name: "盜墓筆記",
            slug: "grave-notes",
            description: "",
          },
        } as never,
        "fallback",
      ),
    ).toEqual({
      unitId: "tag-1",
      name: "盜墓筆記",
      slug: "grave-notes",
    });
  });
});
