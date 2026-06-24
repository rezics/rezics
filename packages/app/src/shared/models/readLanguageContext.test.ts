import { describe, expect, test } from "bun:test";
import {
  resolveReadLanguageContext,
  uniqueReadLanguages,
} from "./readLanguageContext";

describe("readLanguageContext", () => {
  test("normalizes and deduplicates preferred languages", () => {
    expect(uniqueReadLanguages(["EN", "en", "zh-Hant", null])).toEqual([
      "en",
      "zh-hant",
    ]);
  });

  test("uses first preferred language as app locale until the user stores one", () => {
    expect(
      resolveReadLanguageContext({
        activeLocale: "en",
        hasMemberSession: true,
        preferredLanguages: ["ja", "en"],
        storedLocale: null,
      }),
    ).toEqual({ appLocale: "ja", languages: ["ja", "en"] });
    expect(
      resolveReadLanguageContext({
        activeLocale: "en",
        hasMemberSession: true,
        preferredLanguages: ["ja"],
        storedLocale: "en",
      }).appLocale,
    ).toBe("en");
  });
});
