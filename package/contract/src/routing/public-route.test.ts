import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import { publicUnitResolverSearchSchema } from "./public-route";

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
