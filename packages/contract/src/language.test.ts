import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import {
  CONTENT_LANGUAGE_SLUGS,
  contentLanguageSchema,
  francMinLanguageToContentLanguage,
  LANGUAGE_META,
  LANGUAGES,
  languageSchema,
  normalizeContentLanguage,
  normalizeLanguage,
  REZICS_LANGUAGE_REGISTRY,
} from "./language";

describe("language registry", () => {
  test("contains the canonical app language set including Korean", () => {
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

  test("keeps languageSchema scoped to app locale languages", () => {
    expect(Value.Check(languageSchema, "ko")).toBe(true);
    expect(Value.Check(languageSchema, "spa")).toBe(false);
    expect(Value.Check(languageSchema, "ko-KR")).toBe(false);
    expect(Value.Check(languageSchema, "kr")).toBe(false);
  });

  test("validates content languages from the Rezics registry", () => {
    expect(Value.Check(contentLanguageSchema, "ko")).toBe(true);
    expect(Value.Check(contentLanguageSchema, "es")).toBe(true);
    expect(Value.Check(contentLanguageSchema, "fr")).toBe(true);
    expect(Value.Check(contentLanguageSchema, "sco")).toBe(true);
    expect(Value.Check(contentLanguageSchema, "spa")).toBe(false);
    expect(Value.Check(contentLanguageSchema, "fra")).toBe(false);
    expect(Value.Check(contentLanguageSchema, "ko-KR")).toBe(false);
    expect(Value.Check(contentLanguageSchema, "en-US")).toBe(false);
    expect(Value.Check(contentLanguageSchema, "zh")).toBe(false);
    expect(REZICS_LANGUAGE_REGISTRY.length).toBeGreaterThan(70);
  });

  test("keeps content schema in sync with registry slugs", () => {
    const uniqueSlugs = new Set(CONTENT_LANGUAGE_SLUGS);

    expect(uniqueSlugs.size).toBe(CONTENT_LANGUAGE_SLUGS.length);
    for (const slug of CONTENT_LANGUAGE_SLUGS) {
      expect(Value.Check(contentLanguageSchema, slug)).toBe(true);
    }
  });

  test("normalizes only canonical content slugs case-insensitively", () => {
    expect(normalizeLanguage("KO")).toBe("ko");
    expect(normalizeLanguage("ZH-HANT")).toBe("zh-hant");
    expect(normalizeContentLanguage("ES")).toBe("es");
    expect(normalizeContentLanguage("fr")).toBe("fr");
    expect(normalizeContentLanguage("sco")).toBe("sco");
    expect(normalizeContentLanguage("SPA")).toBe(null);
    expect(normalizeContentLanguage("fra")).toBe(null);
    expect(normalizeContentLanguage("zh")).toBe(null);
    expect(normalizeLanguage("ko-KR")).toBe(null);
    expect(normalizeLanguage("kr")).toBe(null);
  });

  test("maps franc-min codes to Rezics content language slugs", () => {
    expect(francMinLanguageToContentLanguage("eng")).toBe("en");
    expect(francMinLanguageToContentLanguage("deu")).toBe("de");
    expect(francMinLanguageToContentLanguage("jpn")).toBe("ja");
    expect(francMinLanguageToContentLanguage("kor")).toBe("ko");
    expect(francMinLanguageToContentLanguage("spa")).toBe("es");
    expect(francMinLanguageToContentLanguage("fra")).toBe("fr");
    expect(francMinLanguageToContentLanguage("arb")).toBe("ar");
    expect(francMinLanguageToContentLanguage("cmn")).toBe("zh-hans");
    expect(
      francMinLanguageToContentLanguage("cmn", {
        text: "繁體中文內容與臺灣用語",
      }),
    ).toBe("zh-hant");
    expect(francMinLanguageToContentLanguage("sco")).toBe(null);
  });
});
