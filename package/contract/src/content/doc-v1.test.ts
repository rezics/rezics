import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import {
  type ContentDoc,
  contentDocMarkdownFallback,
  contentDocSchema,
  extractPollUnitIdsFromContentDoc,
  extractUnitRefIdsFromContentDoc,
  mainMarkdownSource,
  markdownContentDoc,
  markdownContentDocWithPoll,
  pollContentBlock,
  unitRefContentBlock,
} from "./doc-v1";

const doc = (source = "Hello"): ContentDoc => ({
  schema: "rezics.content",
  version: 1,
  main: { type: "markdown", source },
});

describe("contentDocSchema v1", () => {
  test("accepts preferred markdown document", () => {
    expect(Value.Check(contentDocSchema, doc())).toBe(true);
  });

  test("rejects incompatible schema and version", () => {
    expect(
      Value.Check(contentDocSchema, {
        ...doc(),
        schema: "future.content",
        version: 2,
      }),
    ).toBe(false);
  });

  test("accepts fixed before/after main source blocks", () => {
    const value: ContentDoc = {
      ...doc(),
      beforeMain: [{ type: "unit-ref", source: { unitId: "book-1" } }],
      afterMain: [{ type: "poll", source: "poll-1" }],
    };

    expect(Value.Check(contentDocSchema, value)).toBe(true);
  });

  test("rejects dynamic v2 slots and layout", () => {
    const value = {
      ...doc(),
      slots: {
        cast: { type: "entity-list", refs: [] },
      },
      layout: [{ region: "aside", slotId: "cast" }],
    };

    expect(Value.Check(contentDocSchema, value)).toBe(false);
  });
});

describe("content doc v1 helpers", () => {
  test("creates markdown docs with the active v1 version", () => {
    expect(markdownContentDoc("Main text")).toEqual(doc("Main text"));
  });

  test("creates poll region blocks whose source is the poll unit id", () => {
    expect(pollContentBlock("poll-unit-1")).toEqual({
      type: "poll",
      source: "poll-unit-1",
    });
    expect(markdownContentDocWithPoll("Main text", "poll-unit-1")).toEqual({
      ...doc("Main text"),
      afterMain: [{ type: "poll", source: "poll-unit-1" }],
    });
  });

  test("extracts distinct poll ids from both fixed regions in order", () => {
    expect(
      extractPollUnitIdsFromContentDoc({
        ...doc(),
        beforeMain: [
          pollContentBlock("poll-1"),
          { type: "unit-ref", source: { unitId: "book-1" } },
          pollContentBlock("poll-2"),
        ],
        afterMain: [pollContentBlock("poll-1"), pollContentBlock("poll-3")],
      }),
    ).toEqual(["poll-1", "poll-2", "poll-3"]);
  });

  test("extracts distinct structured unit-ref ids and ignores markdown links", () => {
    expect(
      extractUnitRefIdsFromContentDoc({
        ...doc("[Book](https://rezics.example/book/book-markdown)"),
        beforeMain: [
          unitRefContentBlock({ unitId: "book-1", unitType: "BOOK" }),
          unitRefContentBlock({ unitId: "book-2" }),
        ],
        afterMain: [
          unitRefContentBlock({ unitId: "book-1" }),
          { type: "unit-ref", source: { unitId: "" } },
          { type: "unit-ref", source: "book-3" },
        ],
      }),
    ).toEqual(["book-1", "book-2"]);
  });

  test("ignores malformed poll blocks and legacy docs without regions", () => {
    expect(extractPollUnitIdsFromContentDoc(doc())).toEqual([]);
    expect(
      extractPollUnitIdsFromContentDoc({
        ...doc(),
        beforeMain: [
          { type: "poll" },
          { type: "poll", source: "" },
          { type: "poll", source: 123 },
          { type: "poll", source: "poll-1", extra: true },
        ],
        afterMain: "not-a-region",
      }),
    ).toEqual(["poll-1"]);
  });

  test("reads main markdown from unknown input", () => {
    expect(mainMarkdownSource(doc("Main text"))).toBe("Main text");
    expect(
      mainMarkdownSource({ main: { type: "html", source: "<p />" } }),
    ).toBeNull();
  });

  test("falls back to string or serialized JSON when no main markdown exists", () => {
    expect(contentDocMarkdownFallback("raw")).toBe("raw");
    expect(contentDocMarkdownFallback({ type: "unknown" })).toBe(
      '{"type":"unknown"}',
    );
  });
});
