import type { BookDTO, UnitTranslationDTO } from "@rezics/contract";
import { describe, expect, test } from "bun:test";
import { upsertCachedTranslation } from "@rezics/api/react-query/cache-coherence";
import { translationToDraft } from "../hooks/useBookTranslationEditor";

const oldTranslation = {
  unitId: "book-1",
  language: "zh-hant",
  title: "Old",
  summary: "Old summary",
} satisfies UnitTranslationDTO;

describe("Book edit translation cache coherence", () => {
  test("save then clear draft falls back to the edited cached translation", () => {
    const cachedBook = {
      unitId: "book-1",
      translations: [oldTranslation],
    } satisfies BookDTO;

    const nextBook = upsertCachedTranslation(cachedBook, {
      ...oldTranslation,
      title: "New",
      summary: "New summary",
    });

    const draftAfterClear = translationToDraft(
      nextBook?.translations?.find(
        (translation) => translation.language === "zh-hant",
      ),
    );

    expect(draftAfterClear.title).toBe("New");
    expect(draftAfterClear.summary).toBe("New summary");
  });
});
