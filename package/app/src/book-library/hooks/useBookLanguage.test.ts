import { describe, expect, test } from "bun:test";
import type { BookDTO } from "@rezics/contract";
import { resolveSelectedBookLanguage } from "./useBookLanguage";

function book(
  unitId: string,
  languages: string[],
  defaultLanguage = languages[0],
): BookDTO {
  return {
    unitId,
    defaultLanguage: defaultLanguage as never,
    translations: languages.map((language) => ({
      unitId,
      language: language as never,
      title: `${unitId}-${language}`,
    })),
  } as BookDTO;
}

describe("resolveSelectedBookLanguage", () => {
  test("keeps stored language only when it exists on the current release", () => {
    const englishRelease = book("release-en", ["en"], "en");
    const japaneseRelease = book("release-ja", ["ja"], "ja");

    expect(
      resolveSelectedBookLanguage(["ja", "en"], englishRelease, "ja"),
    ).toBe("en");
    expect(
      resolveSelectedBookLanguage(["ja", "en"], japaneseRelease, "ja"),
    ).toBe("ja");
  });
});
