import { describe, expect, mock, test } from "bun:test";
import type { BookDTO } from "@rezics/contract";

mock.module("@/shared/hooks/useReadLanguageCandidates", () => ({
  useReadLanguageContext: () => ({
    appLocale: "zh-hant",
    languages: ["en"],
    ready: true,
  }),
}));

const { resolveSelectedBookLanguage } = await import("./useBookLanguage");

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

    expect(
      resolveSelectedBookLanguage("zh-hant", ["ja", "en"], englishEntry, "ja"),
    ).toBe("en");
    expect(
      resolveSelectedBookLanguage("zh-hant", ["ja", "en"], japaneseEntry, "ja"),
    ).toBe("ja");
  });

  test("uses app locale before user preferred languages when no stored selection exists", () => {
    const entry = book("entry", ["zh-hant", "en"], "en");

    expect(resolveSelectedBookLanguage("zh-hant", ["en"], entry, null)).toBe(
      "zh-hant",
    );
  });

  test("falls back to preferred languages when app locale is unavailable", () => {
    const entry = book("entry", ["ja", "en"], "ja");

    expect(resolveSelectedBookLanguage("zh-hant", ["en"], entry, null)).toBe(
      "en",
    );
  });

  test("keeps an explicit stored selection above app locale", () => {
    const entry = book("entry", ["zh-hant", "en"], "zh-hant");

    expect(
      resolveSelectedBookLanguage("zh-hant", ["zh-hant"], entry, "en"),
    ).toBe("en");
  });
});
