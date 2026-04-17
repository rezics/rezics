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
      "[tag1] type:book lang:ja nsfw:yes licensed:no in:my-realm sort:newest hello",
    );
    expect(result).toEqual({
      tags: [{ slug: "tag1" }],
      type: ["book"],
      languages: ["ja"],
      nsfw: true,
      isLicensed: false,
      realm: { slug: "my-realm" },
      sort: "newest",
      keyword: "hello",
    });
  });

  test("parses multiple types", () => {
    const result = parseSearchString("type:book type:game test");
    expect(result).toEqual({
      type: ["book", "game"],
      keyword: "test",
    });
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
