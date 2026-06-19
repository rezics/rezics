import { describe, expect, it } from "bun:test";
import type { PageSection } from "@rezics/contract";
import {
  normalizeDynamicTagUnitIds,
  selectPageDynamicTags,
} from "./zoneDynamicTags";

function dynamicSection(
  id: string,
  options: Array<{ tagUnitIds: string[]; probability: number }>,
  groupId = "topics",
  fallback = false,
): PageSection {
  return {
    nodeId: id,
    slug: id,
    kind: "query",
    query: {
      target: "unit",
      types: ["BOOK"],
      sort: { field: "hotScore", direction: "desc" },
    },
    display: "carousel",
    dynamicTags: {
      groupId,
      fallback,
      options,
    },
  };
}

describe("zone dynamic tags", () => {
  it("normalizes tag sets independent of order", () => {
    expect(normalizeDynamicTagUnitIds(["tag-b", "tag-a"])).toBe("tag-a|tag-b");
  });

  it("keeps selections stable for a fixed page visit seed", () => {
    const sections = [
      dynamicSection("a", [
        { tagUnitIds: ["tag-a"], probability: 0.5 },
        { tagUnitIds: ["tag-b"], probability: 0.5 },
      ]),
    ];

    expect(selectPageDynamicTags(sections, "visit-1")).toEqual(
      selectPageDynamicTags(sections, "visit-1"),
    );
  });

  it("avoids repeating the same tag set within a group before exhaustion", () => {
    const options = [
      { tagUnitIds: ["tag-a"], probability: 0.5 },
      { tagUnitIds: ["tag-b"], probability: 0.5 },
    ];
    const selections = selectPageDynamicTags(
      [
        dynamicSection("a", options),
        dynamicSection("b", options),
        dynamicSection("c", options),
      ],
      "visit-2",
    );

    const firstTwo = [selections.a, selections.b].map((tags) =>
      normalizeDynamicTagUnitIds(tags ?? []),
    );
    expect(new Set(firstTwo).size).toBe(2);
    expect(selections.c).toBeDefined();
  });

  it("can select fallback as a no-tag option", () => {
    const selections = selectPageDynamicTags(
      [
        dynamicSection(
          "a",
          [{ tagUnitIds: ["tag-a"], probability: 0 }],
          "g",
          true,
        ),
      ],
      "visit-3",
    );

    expect(selections.a).toEqual([]);
  });
});
