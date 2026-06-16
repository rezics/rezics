import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import { zoneSectionDataSchema } from "../zone/zone";
import { streamQuerySchema, streamResponseSchema } from "./stream-list";

describe("streamQuerySchema", () => {
  test("accepts zone stream scope with a concrete zone Unit id", () => {
    expect(
      Value.Check(streamQuerySchema, {
        scope: "zone",
        zoneUnitId: "zone-1",
        limit: 20,
      }),
    ).toBe(true);
  });

  test("accepts home stream type filters", () => {
    expect(
      Value.Check(streamQuerySchema, {
        scope: "home",
        filterType: "zone",
        limit: 20,
      }),
    ).toBe(true);
  });
});

describe("zoneSectionDataSchema stream rows", () => {
  test("accepts renderable stream rows alongside compact items", () => {
    expect(
      Value.Check(zoneSectionDataSchema, {
        pageId: "page-1",
        sectionId: "section-1",
        items: [],
        rows: [
          {
            type: "book",
            rowId: "book:book-1",
            href: "/book/book-1",
            book: {
              unitId: "book-1",
              kind: "book",
              title: "Book",
            },
          },
        ],
        nextCursor: null,
      }),
    ).toBe(true);
  });
});

describe("streamResponseSchema", () => {
  test("accepts zone stream responses", () => {
    expect(
      Value.Check(streamResponseSchema, {
        scope: "zone",
        sort: "new",
        rows: [],
        nextCursor: null,
      }),
    ).toBe(true);
  });

  test("accepts generic Unit stream rows", () => {
    expect(
      Value.Check(streamResponseSchema, {
        scope: "home",
        sort: "new",
        rows: [
          {
            type: "unit",
            rowId: "unit:zone-1",
            href: "/zone/zone-1/search",
            unit: {
              id: "zone-1",
              unitId: "zone-1",
              type: "ZONE",
              slug: null,
              title: "Zone",
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
