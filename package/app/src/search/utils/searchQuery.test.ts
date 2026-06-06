import { describe, expect, test } from "bun:test";
import { buildSearchPath } from "./searchQuery";

describe("buildSearchPath", () => {
  test("global scope produces /search?q=…", () => {
    expect(
      buildSearchPath({ scope: { kind: "global" }, keyword: "magic" }),
    ).toBe("/search?q=magic");
  });

  test("global scope is the default when scope omitted", () => {
    expect(buildSearchPath({ keyword: "magic" })).toBe("/search?q=magic");
  });

  test("realm scope nests the realmId in the base path", () => {
    expect(
      buildSearchPath({
        scope: { kind: "realm", realmId: "r-1" },
        keyword: "epic",
      }),
    ).toBe("/realm/r-1/search?q=epic");
  });

  test("user scope nests the userId in the base path", () => {
    expect(
      buildSearchPath({
        scope: { kind: "user", userId: "u-3" },
        keyword: "epic",
      }),
    ).toBe("/user/u-3/search?q=epic");
  });

  test("book scope nests the unitId in the base path", () => {
    expect(
      buildSearchPath({
        scope: { kind: "book", unitId: "b-7" },
        category: "reviews",
        keyword: "deep",
      }),
    ).toBe("/book/b-7/search?q=deep&category=reviews");
  });

  test("saved scope uses the shelf search route", () => {
    expect(
      buildSearchPath({
        scope: {
          kind: "saved",
          shelfId: "saved-shelf-1",
          userId: "user-1",
        },
        category: "shelves",
        keyword: "deep",
      }),
    ).toBe("/shelf/search?q=deep&category=shelves");
  });

  test("category=all is omitted from URL", () => {
    expect(
      buildSearchPath({
        scope: { kind: "global" },
        category: "all",
        keyword: "x",
      }),
    ).toBe("/search?q=x");
  });

  test("non-default category is included", () => {
    expect(
      buildSearchPath({
        scope: { kind: "global" },
        category: "books",
        keyword: "y",
      }),
    ).toBe("/search?q=y&category=books");
  });

  test("empty input still produces base path", () => {
    expect(buildSearchPath({})).toBe("/search");
  });

  test("keyword is URL-encoded", () => {
    const out = buildSearchPath({
      scope: { kind: "global" },
      keyword: "hello world",
    });
    expect(out).toContain("q=hello+world");
  });
});
