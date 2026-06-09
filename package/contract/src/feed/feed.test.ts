import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import { feedQuerySchema, feedResponseSchema } from "./feed";

describe("feedQuerySchema", () => {
  test("accepts zone feed scope with a concrete zone Unit id", () => {
    expect(
      Value.Check(feedQuerySchema, {
        scope: "zone",
        zoneUnitId: "zone-1",
        limit: 20,
      }),
    ).toBe(true);
  });
});

describe("feedResponseSchema", () => {
  test("accepts zone feed responses", () => {
    expect(
      Value.Check(feedResponseSchema, {
        scope: "zone",
        sort: "new",
        rows: [],
        nextCursor: null,
      }),
    ).toBe(true);
  });
});
