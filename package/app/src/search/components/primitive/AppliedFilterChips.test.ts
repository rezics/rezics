import { describe, expect, it } from "bun:test";
import { buildAppliedFilterChips } from "./AppliedFilterChips";

describe("buildAppliedFilterChips", () => {
  it("renders one chip per user tag", () => {
    const chips = buildAppliedFilterChips({
      tags: [{ slug: "a" }, { slug: "b" }],
    });
    expect(chips.map((c) => c.key)).toEqual(["tag:a", "tag:b"]);
  });

  it("hides tags present in `hide`", () => {
    const chips = buildAppliedFilterChips(
      { tags: [{ slug: "a" }, { slug: "b" }] },
      { tags: [{ slug: "a" }] },
    );
    expect(chips.map((c) => c.key)).toEqual(["tag:b"]);
  });

  it("suppresses fields listed in `rendered`", () => {
    const chips = buildAppliedFilterChips(
      { keyword: "foo", tags: [{ slug: "a" }] },
      {},
      ["keyword"],
    );
    expect(chips.find((c) => c.key.startsWith("keyword"))).toBeUndefined();
    expect(chips.find((c) => c.key === "tag:a")).toBeDefined();
  });

  it("renders nsfw & licensed & sort chips when not hidden or rendered", () => {
    const chips = buildAppliedFilterChips({
      nsfw: true,
      isLicensed: false,
      sort: "createdAt",
    });
    expect(chips.find((c) => c.key.startsWith("nsfw"))).toBeDefined();
    expect(chips.find((c) => c.key.startsWith("licensed"))).toBeDefined();
    expect(chips.find((c) => c.key.startsWith("sort"))).toBeDefined();
  });

  it("renders textLength range chip", () => {
    const chips = buildAppliedFilterChips({
      textLength: { min: 100, max: 500 },
    });
    const chip = chips.find((c) => c.key.startsWith("textLength"));
    expect(chip?.label).toBe("Words: 100–500");
  });

  it("hides realm when implicit realm matches", () => {
    const chips = buildAppliedFilterChips(
      { realm: { slug: "zone1" } },
      { realm: { slug: "zone1" } },
    );
    expect(chips.find((c) => c.key.startsWith("realm"))).toBeUndefined();
  });

  it("remove patch for tag drops only that slug", () => {
    const chips = buildAppliedFilterChips({
      tags: [{ slug: "a" }, { slug: "b" }],
    });
    const chipA = chips.find((c) => c.key === "tag:a");
    expect(chipA?.remove).toEqual({ tags: [{ slug: "b" }] });
  });
});
