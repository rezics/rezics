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
    { language: "de", isPrimary: false, position: "d" },
    { language: "ja", isPrimary: true, position: "b" },
    { language: "en", isPrimary: true, position: "a" },
    { language: "ko", isPrimary: false, position: "c" },
  ];

  test("derives multiple primary languages from support languages", () => {
    expect(primaryLanguages(supportLanguages)).toEqual(["en", "ja"]);
  });

  test("orders read candidates from explicit, app locale, preferences, support languages, then fallback", () => {
    expect(
      readLanguageCandidates({
        explicitLanguage: "ko",
        languages: ["zh-hant"],
        preferredLanguages: ["ja", "en"],
        appLocale: "de",
        supportLanguages,
        fallbackLanguage: "zh-hant",
      }),
    ).toEqual(["ko", "de", "zh-hant", "ja", "en"]);
  });

  test("resolves against support languages instead of translation availability", () => {
    expect(
      resolveReadLanguage({
        preferredLanguages: ["ja"],
        appLocale: "de",
        supportLanguages,
        availableLanguages: ["de"],
      }),
    ).toBe("de");
  });

  test("falls back to content language priority when preferences do not match", () => {
    expect(
      resolveReadLanguage({
        preferredLanguages: ["zh-hans"],
        languages: ["zh-hant"],
        supportLanguages,
      }),
    ).toBe("en");
  });

  test("app locale outranks preferred languages when both are supported", () => {
    expect(
      resolveReadLanguage({
        preferredLanguages: ["ja", "en"],
        appLocale: "de",
        supportLanguages,
      }),
    ).toBe("de");
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
