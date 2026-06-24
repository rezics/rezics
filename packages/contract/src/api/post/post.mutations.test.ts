import { describe, expect, test } from "bun:test";
import type { PostResponse } from "@rezics/contract";
import { QueryClient } from "@tanstack/react-query";
import { unitKeys } from "../unit/unit.keys";
import { postKeys } from "./post.keys";
import { syncPostMutationCache } from "./post.mutations";

const updatedPost = {
  unitId: "post-1",
  authorUserId: "user-1",
  targetUnitId: "book-1",
  variantUnitId: "variant-1",
  realmUnitId: "realm-1",
  title: "New title",
  content: {
    schema: "rezics.content",
    version: 1,
    main: { type: "markdown", source: "New body" },
  },
} satisfies PostResponse;

describe("post mutation cache sync", () => {
  test("updates the exact detail cache and invalidates language-aware detail variants", async () => {
    const queryClient = new QueryClient();
    const exactDetailKey = postKeys.detail("post-1");
    const languageDetailKey = postKeys.detail("post-1", {
      languages: ["zh-hant", "en"],
    });

    queryClient.setQueryData(exactDetailKey, {
      ...updatedPost,
      title: "Old title",
    });
    queryClient.setQueryData(languageDetailKey, {
      ...updatedPost,
      title: "Old localized title",
    });

    await syncPostMutationCache({
      queryClient,
      unitId: "post-1",
      data: updatedPost,
    });

    expect(queryClient.getQueryData<PostResponse>(exactDetailKey)?.title).toBe(
      "New title",
    );
    expect(
      queryClient.getQueryCache().find({ queryKey: exactDetailKey })?.state
        .isInvalidated,
    ).toBe(true);
    expect(
      queryClient.getQueryCache().find({ queryKey: languageDetailKey })?.state
        .isInvalidated,
    ).toBe(true);
  });

  test("invalidates unit language content used to seed editors", async () => {
    const queryClient = new QueryClient();
    const languageContentKey = unitKeys.languageContent("post-1", {
      appLocale: "zh-hant",
    });

    queryClient.setQueryData(languageContentKey, {
      unitId: "post-1",
      resolvedLanguage: "zh-hant",
      title: "Old title",
    });

    await syncPostMutationCache({
      queryClient,
      unitId: "post-1",
      data: updatedPost,
    });

    expect(
      queryClient.getQueryCache().find({ queryKey: languageContentKey })?.state
        .isInvalidated,
    ).toBe(true);
  });

  test("invalidates latest and scoped list variants by prefix", async () => {
    const queryClient = new QueryClient();
    const latestListKey = postKeys.list({
      sort: { field: "updatedAt", order: "desc" },
      limit: 20,
    });
    const targetListKey = postKeys.byTarget("book-1", {
      sort: { field: "updatedAt", order: "desc" },
    });
    const realmListKey = postKeys.byRealm("realm-1", {
      sort: { field: "updatedAt", order: "desc" },
    });
    const authorListKey = postKeys.byAuthor("user-1", {
      sort: { field: "updatedAt", order: "desc" },
    });

    for (const queryKey of [
      latestListKey,
      targetListKey,
      realmListKey,
      authorListKey,
    ]) {
      queryClient.setQueryData(queryKey, { posts: [updatedPost] });
    }

    await syncPostMutationCache({
      queryClient,
      unitId: "post-1",
      data: updatedPost,
    });

    for (const queryKey of [
      latestListKey,
      targetListKey,
      realmListKey,
      authorListKey,
    ]) {
      expect(
        queryClient.getQueryCache().find({ queryKey })?.state.isInvalidated,
      ).toBe(true);
    }
  });

  test("does not resolve until invalidations finish", async () => {
    const queryClient = new QueryClient();
    const originalInvalidateQueries =
      queryClient.invalidateQueries.bind(queryClient);
    let resolved = false;
    let releaseInvalidation: () => void;
    const invalidationGate = new Promise<void>((resolve) => {
      releaseInvalidation = resolve;
    });

    queryClient.invalidateQueries = async (filters, options) => {
      await invalidationGate;
      return originalInvalidateQueries(filters, options);
    };

    const sync = syncPostMutationCache({
      queryClient,
      unitId: "post-1",
      data: updatedPost,
    }).then(() => {
      resolved = true;
    });

    await Promise.resolve();
    expect(resolved).toBe(false);

    releaseInvalidation!();
    await sync;
    expect(resolved).toBe(true);
  });
});
