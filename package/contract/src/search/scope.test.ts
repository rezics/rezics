import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import { SearchScopeSchema } from "./scope";

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
