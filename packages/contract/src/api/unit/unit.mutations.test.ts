import { describe, expect, test } from "bun:test";
import type { UnitTranslationDTO } from "@rezics/contract";
import { QueryClient } from "@tanstack/react-query";
import { bookKeys } from "../book/book.keys";
import { unitKeys } from "./unit.keys";
import {
  syncDeleteTranslationMutationCache,
  syncUpsertTranslationMutationCache,
} from "./unit.mutations";

describe("unit translation mutation cache sync", () => {
  test("patches affected domain detail caches before caller success work", async () => {
    const queryClient = new QueryClient();
    const detailKey = bookKeys.detail("book-1");
    const translation = {
      unitId: "book-1",
      language: "zh-hant",
      title: "New",
    } satisfies UnitTranslationDTO;

    queryClient.setQueryData(detailKey, {
      unitId: "book-1",
      translations: [{ ...translation, title: "Old" }],
    });

    await syncUpsertTranslationMutationCache({
      queryClient,
      variables: {
        unitId: "book-1",
        language: "zh-hant",
        input: { title: "New" },
      },
      data: translation,
      affectedDetailKeys: () => [detailKey],
    });

    const beforeCallerOnSuccess = queryClient.getQueryData<{
      translations?: UnitTranslationDTO[];
    }>(detailKey);

    expect(beforeCallerOnSuccess?.translations?.[0]?.title).toBe("New");
  });

  test("removes deleted translations from affected detail caches", async () => {
    const queryClient = new QueryClient();
    const detailKey = bookKeys.detail("book-1");

    queryClient.setQueryData(detailKey, {
      unitId: "book-1",
      translations: [
        { unitId: "book-1", language: "zh-hant", title: "Title" },
        { unitId: "book-1", language: "ja", title: "Japanese title" },
      ],
    });

    await syncDeleteTranslationMutationCache({
      queryClient,
      variables: { unitId: "book-1", language: "zh-hant" },
      data: { message: "ok" },
      affectedDetailKeys: () => [detailKey],
    });

    expect(
      queryClient
        .getQueryData<{ translations?: UnitTranslationDTO[] }>(detailKey)
        ?.translations?.map((translation) => translation.language),
    ).toEqual(["ja"]);
  });

  test("keeps existing Unit detail and Unit list invalidation behavior", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(unitKeys.detail("book-1"), { id: "book-1" });
    queryClient.setQueryData(unitKeys.lists(), []);

    await syncUpsertTranslationMutationCache({
      queryClient,
      variables: {
        unitId: "book-1",
        language: "zh-hant",
        input: { title: "New" },
      },
      data: { unitId: "book-1", language: "zh-hant", title: "New" },
    });

    expect(
      queryClient.getQueryCache().find({ queryKey: unitKeys.detail("book-1") })
        ?.state.isInvalidated,
    ).toBe(true);
    expect(
      queryClient.getQueryCache().find({ queryKey: unitKeys.lists() })?.state
        .isInvalidated,
    ).toBe(true);
  });
});
