import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import {
  isPublicRealmIdRouteParams,
  publicUnitResolverSearchSchema,
} from "./public-route";

describe("public Unit resolver search schema", () => {
  test("accepts omitted view", () => {
    expect(Value.Check(publicUnitResolverSearchSchema, {})).toBe(true);
  });

  test("accepts view=auto", () => {
    expect(Value.Check(publicUnitResolverSearchSchema, { view: "auto" })).toBe(
      true,
    );
  });

  test("accepts view=unit", () => {
    expect(Value.Check(publicUnitResolverSearchSchema, { view: "unit" })).toBe(
      true,
    );
  });

  test("rejects invalid view values", () => {
    expect(Value.Check(publicUnitResolverSearchSchema, { view: "raw" })).toBe(
      false,
    );
  });
});

describe("public realm id route params", () => {
  test("accepts UUID-shaped unit ids", () => {
    expect(
      isPublicRealmIdRouteParams({
        unitId: "018f9326-8d80-7b86-bc9f-ccceec9a43f5",
      }),
    ).toBe(true);
  });

  test("rejects slug-shaped values", () => {
    expect(isPublicRealmIdRouteParams({ unitId: "rezics" })).toBe(false);
  });
});
