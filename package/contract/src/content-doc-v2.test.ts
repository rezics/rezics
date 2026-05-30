import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import { contentDocV2Schema } from "./content-doc-v2";

describe("contentDocV2Schema", () => {
  test("keeps dynamic slots and layout as draft v2 shape", () => {
    const value = {
      schema: "rezics.content",
      version: 2,
      main: { type: "markdown", source: "Hello" },
      slots: {
        cast: { type: "entity-list", refs: [] },
        future: { type: "future-experiment", arbitrary: { nested: true } },
      },
      layout: [{ region: "aside", slotId: "cast" }],
    };

    expect(Value.Check(contentDocV2Schema, value)).toBe(true);
  });
});
