import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import {
  type ContentDoc,
  contentDocSchema,
  contentDocMarkdownFallback,
  mainMarkdownSource,
  markdownContentDoc,
} from "./content-doc-v1";

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
    const value: ContentDoc = {
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
