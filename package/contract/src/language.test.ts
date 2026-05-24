import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import {
  LANGUAGE_META,
  LANGUAGES,
  languageSchema,
  normalizeLanguage,
} from "./language";

describe("language registry", () => {
  test("contains the canonical language set including Korean", () => {
    expect(Object.values(LANGUAGES)).toEqual([
      "zh-hant",
      "zh-hans",
      "en",
      "ja",
      "de",
      "ko",
    ]);
    expect(LANGUAGE_META.ko).toEqual({
      name: "Korean",
      nativeName: "한국어",
    });
  });

  test("validates only canonical Korean language code", () => {
    expect(Value.Check(languageSchema, "ko")).toBe(true);
    expect(Value.Check(languageSchema, "ko-KR")).toBe(false);
    expect(Value.Check(languageSchema, "kr")).toBe(false);
  });

  test("normalizes canonical codes case-insensitively", () => {
    expect(normalizeLanguage("KO")).toBe("ko");
    expect(normalizeLanguage("ZH-HANT")).toBe("zh-hant");
    expect(normalizeLanguage("ko-KR")).toBe(null);
    expect(normalizeLanguage("kr")).toBe(null);
  });
});
