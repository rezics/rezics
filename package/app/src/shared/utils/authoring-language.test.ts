import { describe, expect, test } from "bun:test";
import { resolveAuthoringLanguageDefault } from "./authoring-language";

describe("resolveAuthoringLanguageDefault", () => {
  test("uses the first preferred language before app locale", () => {
    expect(
      resolveAuthoringLanguageDefault({
        preferredLanguages: ["ja", "en"],
        appLocale: "de",
      }),
    ).toBe("ja");
  });

  test("normalizes broad content language codes", () => {
    expect(
      resolveAuthoringLanguageDefault({
        preferredLanguages: ["fr", "zh-Hant"],
        appLocale: "en-US",
        fallbackLanguage: "en",
      }),
    ).toBe("fr");
  });

  test("falls back when no user or app language is usable", () => {
    expect(
      resolveAuthoringLanguageDefault({
        preferredLanguages: [],
        appLocale: "fr",
        fallbackLanguage: "en",
      }),
    ).toBe("en");
  });
});
