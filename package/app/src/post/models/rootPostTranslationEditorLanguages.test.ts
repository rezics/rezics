import { describe, expect, test } from "bun:test";
import { rootPostEditorLanguages } from "./rootPostTranslationEditorLanguages";

describe("rootPostEditorLanguages", () => {
  test("uses support languages without adding an unsupported selected locale", () => {
    expect(
      rootPostEditorLanguages({
        supportLanguages: [{ language: "zh-hant" }],
        draftLanguages: [],
        fallbackLanguage: "en",
      }),
    ).toEqual(["zh-hant"]);
  });

  test("includes languages explicitly added as local drafts", () => {
    expect(
      rootPostEditorLanguages({
        supportLanguages: [{ language: "zh-hant" }],
        draftLanguages: ["en"],
      }),
    ).toEqual(["zh-hant", "en"]);
  });

  test("falls back only when the backend has no supported languages", () => {
    expect(
      rootPostEditorLanguages({
        supportLanguages: [],
        draftLanguages: [],
        fallbackLanguage: "en",
      }),
    ).toEqual(["en"]);
  });
});
