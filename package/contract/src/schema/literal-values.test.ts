import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import { literalSchemaFromValues } from "./literal-values";

describe("literalSchemaFromValues", () => {
  test("accepts all values from a multi-value tuple and rejects unknown values", () => {
    const schema = literalSchemaFromValues(["page", "dock"] as const);

    expect(Value.Check(schema, "page")).toBe(true);
    expect(Value.Check(schema, "dock")).toBe(true);
    expect(Value.Check(schema, "realm")).toBe(false);
  });

  test("returns a literal-compatible schema for a single-value tuple", () => {
    const schema = literalSchemaFromValues(["main"] as const);

    expect(Value.Check(schema, "main")).toBe(true);
    expect(Value.Check(schema, "wiki")).toBe(false);
  });

  test("rejects empty tuples", () => {
    expect(() => literalSchemaFromValues([] as const)).toThrow(
      "literalSchemaFromValues requires at least one value",
    );
  });
});
