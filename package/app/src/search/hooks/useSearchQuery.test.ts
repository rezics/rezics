import type { SearchQuery } from "@rezics/contract";
import { describe, expect, it } from "bun:test";
import {
  mergeAppend,
  mergeEffective,
  mergeOverwrite,
  unionStrings,
  unionTags,
} from "./useSearchQuery";

describe("unionTags", () => {
  it("dedupes by slug, preserving first occurrence", () => {
    const result = unionTags(
      [{ slug: "a" }, { slug: "b" }],
      [{ slug: "b", unitId: "u1" }, { slug: "c" }],
    );
    expect(result).toEqual([
      { slug: "a" },
      { slug: "b" },
      { slug: "c" },
    ]);
  });

  it("returns empty when both inputs empty", () => {
    expect(unionTags([], [])).toEqual([]);
  });
});

describe("unionStrings", () => {
  it("dedupes strings", () => {
    expect(unionStrings(["a", "b"], ["b", "c"])).toEqual(["a", "b", "c"]);
  });
});

describe("mergeAppend", () => {
  it("unions tags by slug", () => {
    const prev: SearchQuery = { tags: [{ slug: "a" }] };
    const next = mergeAppend(prev, { tags: [{ slug: "b" }, { slug: "a" }] });
    expect(next.tags).toEqual([{ slug: "a" }, { slug: "b" }]);
  });

  it("unions type, postKind, languages", () => {
    const prev: SearchQuery = {
      type: ["BOOK"],
      postKind: ["REVIEW"],
      languages: ["en"],
    };
    const next = mergeAppend(prev, {
      type: ["GAME"],
      postKind: ["REMARK"],
      languages: ["zh"],
    });
    expect(next.type).toEqual(["BOOK", "GAME"]);
    expect(next.postKind).toEqual(["REVIEW", "REMARK"]);
    expect(next.languages).toEqual(["en", "zh"]);
  });

  it("replaces keyword", () => {
    const prev: SearchQuery = { keyword: "old" };
    const next = mergeAppend(prev, { keyword: "new" });
    expect(next.keyword).toBe("new");
  });

  it("overwrites scalar fields", () => {
    const prev: SearchQuery = {
      nsfw: true,
      isLicensed: false,
      sort: "createdAt",
      textLength: { min: 100 },
      realm: { slug: "r1" },
    };
    const next = mergeAppend(prev, {
      nsfw: false,
      isLicensed: true,
      sort: "relevance",
      textLength: { max: 500 },
      realm: { slug: "r2" },
    });
    expect(next.nsfw).toBe(false);
    expect(next.isLicensed).toBe(true);
    expect(next.sort).toBe("relevance");
    expect(next.textLength).toEqual({ max: 500 });
    expect(next.realm).toEqual({ slug: "r2" });
  });

  it("preserves prev fields not in patch", () => {
    const prev: SearchQuery = { keyword: "k", tags: [{ slug: "a" }] };
    const next = mergeAppend(prev, { nsfw: true });
    expect(next.keyword).toBe("k");
    expect(next.tags).toEqual([{ slug: "a" }]);
    expect(next.nsfw).toBe(true);
  });
});

describe("mergeOverwrite", () => {
  it("shallow-replaces fields", () => {
    const prev: SearchQuery = { tags: [{ slug: "a" }], keyword: "k" };
    const next = mergeOverwrite(prev, { tags: [] });
    expect(next.tags).toEqual([]);
    expect(next.keyword).toBe("k");
  });
});

describe("mergeEffective", () => {
  it("merges implicit tags with user tags via union", () => {
    const eff = mergeEffective(
      { tags: [{ slug: "zone-tag" }] },
      { tags: [{ slug: "user-tag" }] },
    );
    expect(eff.tags).toEqual([
      { slug: "zone-tag" },
      { slug: "user-tag" },
    ]);
  });

  it("user keyword overrides (implicit has none)", () => {
    const eff = mergeEffective({}, { keyword: "hello" });
    expect(eff.keyword).toBe("hello");
  });

  it("user scalar overrides implicit", () => {
    const eff = mergeEffective(
      { nsfw: false, sort: "createdAt" },
      { nsfw: true },
    );
    expect(eff.nsfw).toBe(true);
    expect(eff.sort).toBe("createdAt");
  });

  it("drops empty array fields", () => {
    const eff = mergeEffective({}, {});
    expect(eff.tags).toBeUndefined();
    expect(eff.type).toBeUndefined();
    expect(eff.postKind).toBeUndefined();
    expect(eff.languages).toBeUndefined();
  });

  it("implicit type merges with user type", () => {
    const eff = mergeEffective(
      { type: ["BOOK"] },
      { type: ["GAME"] },
    );
    expect(eff.type).toEqual(["BOOK", "GAME"]);
  });
});
