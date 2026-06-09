import { describe, expect, test } from "bun:test";
import {
  formatJsonDraft,
  nullableText,
  optionalText,
  parseJsonDraft,
} from "./zoneManageDraft";

describe("zone manage draft helpers", () => {
  test("round-trips JSON drafts with stable formatting", () => {
    const draft = formatJsonDraft({ theme: { accent: "brand" } });
    expect(draft).toContain('"theme"');
    expect(parseJsonDraft("Theme", draft)).toEqual({
      theme: { accent: "brand" },
    });
  });

  test("throws a field-labeled error for invalid JSON", () => {
    expect(() => parseJsonDraft("Sections", "{")).toThrow(
      "Sections must be valid JSON",
    );
  });

  test("normalizes optional and nullable text fields", () => {
    expect(optionalText(" template ")).toBe("template");
    expect(optionalText(" ")).toBeUndefined();
    expect(nullableText(" realm-1 ")).toBe("realm-1");
    expect(nullableText(" ")).toBeNull();
  });
});
