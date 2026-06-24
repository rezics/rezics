import { describe, expect, it } from "bun:test";
import {
  addUniqueDynamicTagUnitIds,
  parseDynamicTagInputTokens,
  removeDynamicTagOptionAt,
  resolveDynamicTagInputTokens,
} from "./zoneDynamicTagInput";

describe("zone dynamic tag input", () => {
  it("parses JSON arrays, comma lists, and newline lists", () => {
    expect(parseDynamicTagInputTokens('["tag-a", "tag-b"]')).toEqual([
      "tag-a",
      "tag-b",
    ]);
    expect(parseDynamicTagInputTokens("tag-a, tag-b\nhistory")).toEqual([
      "tag-a",
      "tag-b",
      "history",
    ]);
  });

  it("adds tag ids without duplicates", () => {
    expect(addUniqueDynamicTagUnitIds(["tag-a"], ["tag-a", "tag-b"])).toEqual([
      "tag-a",
      "tag-b",
    ]);
  });

  it("resolves slugs to canonical tag unit ids and keeps raw ids", async () => {
    const ids = await resolveDynamicTagInputTokens(
      ["science-fiction", "tag-existing", "unknown"],
      async (token) => {
        if (token === "science-fiction") return "tag-sci-fi";
        if (token === "unknown") throw new Error("not found");
        return null;
      },
    );

    expect(ids).toEqual(["tag-sci-fi", "tag-existing", "unknown"]);
  });

  it("removes a whole dynamic tag option row by position", () => {
    const options = [
      { tagUnitIds: ["tag-a"], probability: 0.5 },
      { tagUnitIds: ["tag-b"], probability: 0.5 },
    ];

    expect(removeDynamicTagOptionAt(options, 0)).toEqual([
      { tagUnitIds: ["tag-b"], probability: 0.5 },
    ]);
  });
});
