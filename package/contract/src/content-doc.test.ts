import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import {
  type ContentDoc,
  contentDocSchema,
  extractText,
  scanRefs,
  validateContentDocPreferredShape,
} from "./content-doc";

const doc = (source = "Hello"): ContentDoc => ({
  schema: "rezics.content",
  version: 1,
  main: { type: "markdown", source },
});

describe("contentDocSchema", () => {
  test("accepts preferred markdown document", () => {
    expect(Value.Check(contentDocSchema, doc())).toBe(true);
    expect(validateContentDocPreferredShape(doc()).valid).toBe(true);
  });

  test("reports invalid schema and version as preferred-shape issues", () => {
    const result = validateContentDocPreferredShape({
      ...doc(),
      schema: "future.content",
      version: 2,
    });

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain(
      "invalid-schema",
    );
    expect(result.issues.map((issue) => issue.code)).toContain(
      "invalid-version",
    );
  });

  test("flags slot placement in inline directive and layout", () => {
    const result = validateContentDocPreferredShape({
      ...doc(":slot[cast]{}"),
      slots: {
        cast: { type: "entity-list", refs: [] },
      },
      layout: [{ region: "aside", slotId: "cast" }],
    });

    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "slot-placement-conflict",
        path: "slots.cast",
      }),
    );
  });

  test("accepts unit references and preserves unsupported slot payloads", () => {
    const value = {
      ...doc(),
      slots: {
        hero: {
          type: "unit-ref",
          ref: { unitId: "book-1", unitType: "BOOK" },
        },
        future: {
          type: "future-experiment",
          arbitrary: { nested: true },
        },
      },
    };

    expect(Value.Check(contentDocSchema, value)).toBe(true);
    expect(value.slots.future).toEqual({
      type: "future-experiment",
      arbitrary: { nested: true },
    });
  });
});

describe("scanRefs", () => {
  test("deduplicates and covers v1 slot shapes", () => {
    const value: ContentDoc = {
      ...doc(),
      slots: {
        hero: {
          type: "unit-ref",
          ref: { unitId: "book-1", unitType: "BOOK" },
        },
        cast: {
          type: "entity-list",
          refs: [
            { unitId: "book-1", unitType: "BOOK" },
            { unitId: "entity-1", unitType: "MEDIA" },
          ],
        },
        facts: {
          type: "infobox",
          rows: [
            {
              label: { type: "markdown", source: "Author" },
              value: { unitId: "person-1" },
            },
            {
              label: { type: "markdown", source: "Related" },
              value: [{ unitId: "entity-1", unitType: "MEDIA" }],
            },
          ],
        },
      },
    };

    expect(scanRefs(value)).toEqual([
      { unitId: "book-1", unitType: "BOOK" },
      { unitId: "entity-1", unitType: "MEDIA" },
      { unitId: "person-1" },
    ]);
  });
});

describe("extractText", () => {
  test("includes main and text-bearing fields across slot types", () => {
    const value: ContentDoc = {
      ...doc("Main text"),
      slots: {
        cast: {
          type: "entity-list",
          title: { type: "markdown", source: "Main cast" },
          refs: [{ unitId: "entity-1" }],
        },
        facts: {
          type: "infobox",
          rows: [
            {
              label: { type: "markdown", source: "Author" },
              value: { type: "markdown", source: "Someone" },
            },
            {
              label: { type: "markdown", source: "Website" },
              value: {
                type: "link",
                url: "https://example.com",
                label: "Site",
              },
            },
          ],
        },
        subject: {
          type: "unit-ref",
          ref: { unitId: "entity-1" },
        },
      },
    };

    expect(extractText(value)).toBe(
      ["Main text", "Main cast", "Author", "Someone", "Website", "Site"].join(
        "\n",
      ),
    );
  });
});
