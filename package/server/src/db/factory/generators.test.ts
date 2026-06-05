import { describe, expect, test } from "bun:test";
import type { ContentDoc, PostExtra } from "@rezics/contract";
import { PostKind, UnitType } from "./storage-values.js";
import { generatePostExtra, generateTranslations } from "./generators";

function isContentDoc(value: unknown): value is ContentDoc {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as ContentDoc).schema === "rezics.content" &&
    (value as ContentDoc).version === 1 &&
    (value as ContentDoc).main?.type === "markdown" &&
    typeof (value as ContentDoc).main.source === "string"
  );
}

describe("generatePostExtra", () => {
  test("generates contract-valid excerpt source metadata", () => {
    const extra = generatePostExtra(PostKind.EXCERPT) as PostExtra | null;

    expect(extra).not.toBeNull();
    expect(extra?.source).toEqual({
      mode: "url",
      url: expect.any(String),
      title: expect.any(String),
    });
    expect(extra?.source?.title.length).toBeGreaterThan(0);
    expect(extra?.source?.title.length).toBeLessThanOrEqual(200);
  });
});

describe("generateTranslations", () => {
  test("generates ContentDoc descriptions for seeded unit translations", () => {
    for (const type of [
      UnitType.BOOK,
      UnitType.GAME,
      UnitType.MEDIA,
      UnitType.TAG,
      UnitType.ENTITY,
      UnitType.REALM,
      UnitType.SHELF,
      UnitType.ZONE,
    ]) {
      for (const translation of generateTranslations(type)) {
        if (translation.description === undefined) continue;
        expect(isContentDoc(translation.description)).toBe(true);
      }
    }
  });
});
