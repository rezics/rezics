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

  test("accepts home feed type filters", () => {
    expect(
      Value.Check(feedQuerySchema, {
        scope: "home",
        filterType: "zone",
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

  test("accepts generic Unit feed rows", () => {
    expect(
      Value.Check(feedResponseSchema, {
        scope: "home",
        sort: "new",
        rows: [
          {
            type: "unit",
            rowId: "unit:zone-1",
            href: "/zone/zone-1/search",
            unit: {
              unitId: "zone-1",
              type: "ZONE",
              slug: null,
              title: "Zone",
              description: "A curated zone",
              createdAt: "2026-06-12T00:00:00.000Z",
            },
          },
        ],
        nextCursor: {
          rowId: "unit:zone-1",
          createdAt: "2026-06-12T00:00:00.000Z",
        },
      }),
    ).toBe(true);
  });
});
