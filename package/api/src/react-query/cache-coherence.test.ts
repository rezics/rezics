import type { UnitTranslationDTO } from "@rezics/contract";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, test } from "bun:test";
import {
  patchTranslationDetailQueries,
  preserveCachedTranslations,
  removeCachedTranslation,
  upsertCachedTranslation,
} from "./cache-coherence";

const zh = {
  unitId: "book-1",
  language: "zh-hant",
  title: "Old",
} satisfies UnitTranslationDTO;

describe("translation cache coherence helpers", () => {
  test("appends a missing translation while preserving other fields", () => {
    const detail = {
      unitId: "book-1",
      isbn13: "9780000000000",
      translations: [zh],
    };

    const next = upsertCachedTranslation(detail, {
      unitId: "book-1",
      language: "ja",
      title: "Japanese title",
    });

    expect(next).toEqual({
      unitId: "book-1",
      isbn13: "9780000000000",
      translations: [
        zh,
        {
          unitId: "book-1",
          language: "ja",
          title: "Japanese title",
        },
      ],
    });
  });

  test("replaces a matching translation by language", () => {
    const next = upsertCachedTranslation(
      {
        unitId: "book-1",
        translations: [zh],
      },
      {
        unitId: "book-1",
        language: "zh-hant",
        title: "New",
        summary: "Updated summary",
      },
    );

    expect(next?.translations).toEqual([
      {
        unitId: "book-1",
        language: "zh-hant",
        title: "New",
        summary: "Updated summary",
      },
    ]);
  });

  test("removes a matching translation by language", () => {
    const next = removeCachedTranslation(
      {
        unitId: "book-1",
        translations: [
          zh,
          {
            unitId: "book-1",
            language: "ja",
            title: "Japanese title",
          },
        ],
      },
      "zh-hant",
    );

    expect(next?.translations).toEqual([
      {
        unitId: "book-1",
        language: "ja",
        title: "Japanese title",
      },
    ]);
  });

  test("preserves cached translations when a full detail DTO arrives stale", () => {
    const next = preserveCachedTranslations(
      {
        unitId: "book-1",
        isbn13: "9780000000001",
        translations: [zh],
      },
      {
        unitId: "book-1",
        isbn13: "9780000000000",
        translations: [{ ...zh, title: "New" }],
      },
    );

    expect(next).toEqual({
      unitId: "book-1",
      isbn13: "9780000000001",
      translations: [{ ...zh, title: "New" }],
    });
  });

  test("cancels an exact detail query before patching it", async () => {
    const queryClient = new QueryClient();
    const detailKey = ["books", "detail", "book-1"] as const;
    const calls: string[] = [];
    const originalCancelQueries = queryClient.cancelQueries.bind(queryClient);

    queryClient.setQueryData(detailKey, {
      unitId: "book-1",
      translations: [zh],
    });
    queryClient.cancelQueries = async (filters, options) => {
      calls.push(`cancel:${JSON.stringify(filters?.queryKey)}`);
      return originalCancelQueries(filters, options);
    };

    await patchTranslationDetailQueries({
      queryClient,
      detailKeys: [detailKey],
      translation: { ...zh, title: "New" },
    });

    calls.push(
      `title:${
        queryClient.getQueryData<{ translations?: UnitTranslationDTO[] }>(
          detailKey,
        )?.translations?.[0]?.title
      }`,
    );

    expect(calls).toEqual(['cancel:["books","detail","book-1"]', "title:New"]);
  });
});
