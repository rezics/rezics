import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import { SearchCategorySchema, SearchScopeSchema } from "./scope";

describe("SearchScopeSchema", () => {
  test("accepts exact and work-domain book scopes", () => {
    expect(
      Value.Check(SearchScopeSchema, {
        kind: "book",
        unitId: "release-1",
        scopeMode: "exact",
      }),
    ).toBe(true);
    expect(
      Value.Check(SearchScopeSchema, {
        kind: "book",
        unitId: "release-1",
        workUnitId: "work-1",
        scopeMode: "work",
      }),
    ).toBe(true);
  });
});

describe("SearchCategorySchema", () => {
  test("accepts comments as an independent result category", () => {
    expect(Value.Check(SearchCategorySchema, "comments")).toBe(true);
  });
});
