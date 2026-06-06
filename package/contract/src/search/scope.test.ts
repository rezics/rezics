import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import { SearchCategorySchema, SearchScopeSchema } from "./scope";

describe("SearchScopeSchema", () => {
  test("accepts exact book scopes", () => {
    expect(
      Value.Check(SearchScopeSchema, {
        kind: "book",
        unitId: "release-1",
      }),
    ).toBe(true);
    expect("workUnitId" in SearchScopeSchema.anyOf[1].properties).toBe(false);
    expect("scopeMode" in SearchScopeSchema.anyOf[1].properties).toBe(false);
  });

  test("accepts saved shelf scopes with the concrete shelf and owner", () => {
    expect(
      Value.Check(SearchScopeSchema, {
        kind: "saved",
        shelfId: "saved-shelf-1",
        userId: "user-1",
      }),
    ).toBe(true);
  });
});

describe("SearchCategorySchema", () => {
  test("accepts comments as an independent result category", () => {
    expect(Value.Check(SearchCategorySchema, "comments")).toBe(true);
  });
});
