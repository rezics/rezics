import { describe, expect, test } from "bun:test";
import type { UnitTranslationDTO } from "@rezics/contract";
import { QueryClient } from "@tanstack/react-query";
import {
  CACHE_COHERENCE_MAP,
  CACHE_NAMESPACE_ROOTS,
  invalidateForCacheDomain,
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
    const detail: {
      unitId: string;
      isbn13: string;
      translations: UnitTranslationDTO[];
    } = {
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
      } as { unitId: string; translations: UnitTranslationDTO[] },
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

describe("mutation → query namespace coherence map", () => {
  test("every declared mutation domain maps to ≥1 known namespace", () => {
    for (const [domain, namespaces] of Object.entries(CACHE_COHERENCE_MAP)) {
      expect(namespaces.length).toBeGreaterThan(0);
      for (const ns of namespaces) {
        expect(CACHE_NAMESPACE_ROOTS).toHaveProperty(ns);
      }
    }
  });

  test("node-completion invalidates dashboard and per-book node-completion list", () => {
    const namespaces = CACHE_COHERENCE_MAP["node-completion"];
    expect(namespaces).toContain("dashboard");
    expect(namespaces).toContain("bookNodeCompletionList");
  });

  test("progress invalidates dashboard but NOT the per-book node-completion list", () => {
    const namespaces = CACHE_COHERENCE_MAP.progress;
    expect(namespaces).toContain("dashboard");
    expect(namespaces).not.toContain("bookNodeCompletionList");
  });

  test("invalidateForCacheDomain invalidates each declared namespace root", async () => {
    const invalidated: unknown[] = [];
    const fakeClient = {
      invalidateQueries: ({ queryKey }: { queryKey: unknown }) => {
        invalidated.push(queryKey);
        return Promise.resolve();
      },
    } as unknown as QueryClient;

    await invalidateForCacheDomain(fakeClient, "node-completion");

    for (const ns of CACHE_COHERENCE_MAP["node-completion"]) {
      expect(invalidated).toContainEqual(CACHE_NAMESPACE_ROOTS[ns]);
    }
  });
});
