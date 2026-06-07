import { describe, expect, test } from "bun:test";
import {
  rootPostEditorLanguages,
  seedRootPostEditorDrafts,
  selectRootPostEditorLanguageDraft,
} from "./rootPostTranslationEditorLanguages";

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

describe("root post editor drafts", () => {
  test("seeds backend resolved content without overwriting an existing local draft", () => {
    expect(
      seedRootPostEditorDrafts({
        drafts: {
          "zh-hant": { title: "local title", body: "local body" },
        },
        resolvedLanguage: "zh-hant",
        resolvedTitle: "server title",
        resolvedBody: "server body",
        currentLanguage: "en",
        currentTitle: "english title",
        currentBody: "english body",
      }),
    ).toEqual({
      "zh-hant": { title: "local title", body: "local body" },
      en: { title: "english title", body: "english body" },
    });
  });

  test("selecting another language preserves the current draft before switching", () => {
    const selection = selectRootPostEditorLanguageDraft({
      drafts: {},
      currentLanguage: "en",
      currentTitle: "edited english title",
      currentBody: "edited english body",
      nextLanguage: "zh-hant",
      resolvedLanguage: "zh-hant",
      resolvedTitle: "server zh title",
      resolvedBody: "server zh body",
    });

    expect(selection.drafts.en).toEqual({
      title: "edited english title",
      body: "edited english body",
    });
    expect(selection.nextDraft).toEqual({
      title: "server zh title",
      body: "server zh body",
    });
  });

  test("selecting a language with a local draft restores that draft instead of server fallback", () => {
    expect(
      selectRootPostEditorLanguageDraft({
        drafts: {
          en: { title: "saved english title", body: "saved english body" },
        },
        currentLanguage: "zh-hant",
        currentTitle: "zh title",
        currentBody: "zh body",
        nextLanguage: "en",
        resolvedLanguage: "en",
        resolvedTitle: "server english title",
        resolvedBody: "server english body",
      }).nextDraft,
    ).toEqual({
      title: "saved english title",
      body: "saved english body",
    });
  });

  test("selecting a brand new language starts with an empty draft", () => {
    expect(
      selectRootPostEditorLanguageDraft({
        drafts: {},
        currentLanguage: "en",
        currentTitle: "english title",
        currentBody: "english body",
        nextLanguage: "ko",
        resolvedLanguage: "zh-hant",
        resolvedTitle: "server zh title",
        resolvedBody: "server zh body",
      }).nextDraft,
    ).toEqual({ title: "", body: "" });
  });
});
