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
  test("keeps stored language only when it exists on the current entry", () => {
    const englishEntry = book("entry-en", ["en"], "en");
    const japaneseEntry = book("entry-ja", ["ja"], "ja");

    expect(resolveSelectedBookLanguage(["ja", "en"], englishEntry, "ja")).toBe(
      "en",
    );
    expect(resolveSelectedBookLanguage(["ja", "en"], japaneseEntry, "ja")).toBe(
      "ja",
    );
  });
});
