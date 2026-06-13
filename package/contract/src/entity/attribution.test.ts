import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import {
  entityAttributionBatchParamsSchema,
  entityAttributionBatchRequestSchema,
} from "./attribution";

describe("entity attribution batch schemas", () => {
  test("accepts a valid setCredits batch", () => {
    expect(
      Value.Check(entityAttributionBatchRequestSchema, {
        ops: [
          {
            op: "setCredits",
            role: "author",
            entries: [
              { entityId: "entity-1", position: "a" },
              { entityId: "entity-2", position: "b" },
            ],
          },
        ],
      }),
    ).toBe(true);
  });

  test("accepts a valid setSubjects batch", () => {
    expect(
      Value.Check(entityAttributionBatchRequestSchema, {
        ops: [
          {
            op: "setSubjects",
            role: "primary_character",
            entries: [{ entityId: "entity-1", weight: 0.7 }],
          },
        ],
      }),
    ).toBe(true);
  });

  test("accepts mixed credit and subject batches", () => {
    expect(
      Value.Check(entityAttributionBatchRequestSchema, {
        baseVersion: "7",
        message: "metadata save",
        ops: [
          { op: "setCredits", role: "author", entries: [] },
          {
            op: "setSubjects",
            role: "featured_character",
            entries: [{ entityId: "entity-1", position: "c", weight: null }],
          },
        ],
      }),
    ).toBe(true);
  });

  test("rejects invalid credit and subject roles", () => {
    expect(
      Value.Check(entityAttributionBatchRequestSchema, {
        ops: [{ op: "setCredits", role: "color_assistant", entries: [] }],
      }),
    ).toBe(false);

    expect(
      Value.Check(entityAttributionBatchRequestSchema, {
        ops: [{ op: "setSubjects", role: "sect_founder", entries: [] }],
      }),
    ).toBe(false);
  });

  test("validates unit-scoped batch route params", () => {
    expect(
      Value.Check(entityAttributionBatchParamsSchema, { unitId: "book-1" }),
    ).toBe(true);
    expect(Value.Check(entityAttributionBatchParamsSchema, {})).toBe(false);
  });
});
