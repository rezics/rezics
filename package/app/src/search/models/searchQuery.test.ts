import { describe, expect, test } from "bun:test";
import { parseSearchString, serializeSearchString } from "./searchQuery";

describe("parseSearchString", () => {
  test("parses mixed search string", () => {
    const result = parseSearchString("[light-novel] type:book 異世界");
    expect(result).toEqual({
      tags: [{ slug: "light-novel" }],
      type: ["book"],
      keyword: "異世界",
    });
  });

  test("parses multiple tags", () => {
    const result = parseSearchString("[isekai] [adventure] fantasy");
    expect(result).toEqual({
      tags: [{ slug: "isekai" }, { slug: "adventure" }],
      keyword: "fantasy",
    });
  });

  test("parses keyword-only string", () => {
    const result = parseSearchString("just a keyword search");
    expect(result).toEqual({
      keyword: "just a keyword search",
    });
  });

  test("parses empty string", () => {
    const result = parseSearchString("");
    expect(result).toEqual({});
  });

  test("parses all filter types", () => {
    const result = parseSearchString(
      "[tag1] type:book lang:ja rating:R_18 licensed:no in:my-realm sort:newest hello",
    );
    expect(result).toEqual({
      tags: [{ slug: "tag1" }],
      type: ["book"],
      languages: ["ja"],
      ratings: ["R_18"],
      isLicensed: false,
      realm: { scope: "realm", slug: "my-realm" },
      sort: "newest",
      keyword: "hello",
    });
  });

  test("parses and serializes AI disclosure filters separately from rating", () => {
    const parsed = parseSearchString(
      "rating:GENERAL ai:ai-assisted ai:machine",
    );

    expect(parsed.ratings).toEqual(["GENERAL"]);
    expect(parsed.aiDisclosureModes).toEqual([
      "AI_ASSISTED",
      "MACHINE_GENERATED",
    ]);
    expect(serializeSearchString(parsed)).toContain("ai:AI_ASSISTED");
    expect(serializeSearchString(parsed)).toContain("ai:MACHINE_GENERATED");
  });

  test("parses multiple types", () => {
    const result = parseSearchString("type:book type:game test");
    expect(result).toEqual({
      type: ["book", "game"],
      keyword: "test",
    });
  });

  test("parses kind:review token to canonical REVIEW", () => {
    const result = parseSearchString("kind:review epic");
    expect(result.kind).toBe("REVIEW");
    expect(result.keyword).toBe("epic");
  });

  test("parses kind:excerpts (plural) to EXCERPT", () => {
    const result = parseSearchString("kind:excerpts");
    expect(result.kind).toBe("EXCERPT");
  });

  test("parses kind:wiki token to canonical WIKI", () => {
    const result = parseSearchString("kind:wiki");
    expect(result.kind).toBe("WIKI");
  });

  test("kind is single-valued, last wins", () => {
    const result = parseSearchString("kind:review kind:excerpt");
    expect(result.kind).toBe("EXCERPT");
  });

  test("unknown kind value is silently dropped", () => {
    const result = parseSearchString("kind:bogus hello");
    expect(result.kind).toBeUndefined();
    expect(result.keyword).toBe("hello");
  });
});

describe("serializeSearchString", () => {
  test("serializes structured query to string", () => {
    const result = serializeSearchString({
      tags: [{ slug: "light-novel" }],
      type: ["book"],
      keyword: "異世界",
    });
    expect(result).toBe("[light-novel] type:book 異世界");
  });

  test("serializes empty query", () => {
    expect(serializeSearchString({})).toBe("");
  });

  test("serializes kind back to kind:VALUE", () => {
    expect(serializeSearchString({ kind: "REVIEW" })).toBe("kind:REVIEW");
  });
});

describe("round-trip", () => {
  test("parse then serialize produces equivalent parse", () => {
    const input = "[light-novel] type:book 異世界";
    const parsed = parseSearchString(input);
    const serialized = serializeSearchString(parsed);
    const reparsed = parseSearchString(serialized);
    expect(reparsed).toEqual(parsed);
  });
});
