import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import {
  authoringLanguageCandidates,
  languageResolutionInputSchema,
  parseReadLanguages,
  primaryLanguages,
  readLanguageCandidates,
  resolveReadLanguage,
} from "./language-resolution";

describe("language resolution helpers", () => {
  const supportLanguages = [
    { language: "de", isPrimary: false, sortOrder: 3 },
    { language: "ja", isPrimary: true, sortOrder: 1 },
    { language: "en", isPrimary: true, sortOrder: 0 },
    { language: "ko", isPrimary: false, sortOrder: 2 },
  ];

  test("derives multiple primary languages from support languages", () => {
    expect(primaryLanguages(supportLanguages)).toEqual(["en", "ja"]);
  });

  test("orders read candidates from explicit, preferences, app locale, support languages, then fallback", () => {
    expect(
      readLanguageCandidates({
        explicitLanguage: "ko",
        languages: ["zh-hant"],
        preferredLanguages: ["ja", "en"],
        appLocale: "de",
        supportLanguages,
        fallbackLanguage: "zh-hant",
      }),
    ).toEqual(["ko", "zh-hant", "ja", "en", "de"]);
  });

  test("resolves against support languages instead of translation availability", () => {
    expect(
      resolveReadLanguage({
        preferredLanguages: ["ja"],
        appLocale: "de",
        supportLanguages,
        availableLanguages: ["de"],
      }),
    ).toBe("ja");
  });

  test("parses comma-separated read language candidates", () => {
    expect(parseReadLanguages("zh-hant, ja, en,ja")).toEqual([
      "zh-hant",
      "ja",
      "en",
    ]);
  });

  test("orders authoring candidates from explicit, first preference, app locale, then fallback", () => {
    expect(
      authoringLanguageCandidates({
        explicitLanguage: undefined,
        preferredLanguages: ["ja", "en"],
        appLocale: "de",
        fallbackLanguage: "zh-hant",
      }),
    ).toEqual(["ja", "de", "zh-hant"]);
  });

  test("accepts omitted explicitLanguage in resolution input", () => {
    expect(
      Value.Check(languageResolutionInputSchema, {
        preferredLanguages: ["en"],
        appLocale: "ja",
      }),
    ).toBe(true);
  });
});
