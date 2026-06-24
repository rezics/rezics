import { describe, expect, test } from "bun:test";
import { isSearchCategory } from "../models/category";

describe("isSearchCategory", () => {
  test("accepts every contract category", () => {
    for (const c of [
      "all",
      "mixed",
      "books",
      "reviews",
      "excerpts",
      "remarks",
      "posts",
      "shelves",
      "realms",
      "users",
      "entities",
    ] as const) {
      expect(isSearchCategory(c)).toBe(true);
    }
  });

  test("rejects unknown values", () => {
    expect(isSearchCategory("chapters")).toBe(false);
    expect(isSearchCategory("foo")).toBe(false);
    expect(isSearchCategory("")).toBe(false);
    expect(isSearchCategory(undefined)).toBe(false);
  });
});
