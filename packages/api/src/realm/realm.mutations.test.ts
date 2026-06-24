import { describe, expect, test } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { realmKeys } from "./realm.keys";
import { syncRealmMembershipMutationCache } from "./realm.mutations";

describe("realm membership mutation cache sync", () => {
  test("invalidates exact and language-aware mine queries after membership changes", async () => {
    const queryClient = new QueryClient();
    const exactMineKey = realmKeys.mine();
    const languageMineKey = realmKeys.mine({
      languages: ["zh-hant", "en"],
      appLocale: "zh-hant",
    });
    const membershipKey = realmKeys.members("realm-1");
    const detailKey = realmKeys.detail("realm-1");

    for (const queryKey of [
      exactMineKey,
      languageMineKey,
      membershipKey,
      detailKey,
    ]) {
      queryClient.setQueryData(queryKey, {});
    }

    await syncRealmMembershipMutationCache({
      queryClient,
      realmUnitId: "realm-1",
    });

    for (const queryKey of [
      exactMineKey,
      languageMineKey,
      membershipKey,
      detailKey,
    ]) {
      expect(
        queryClient.getQueryCache().find({ queryKey })?.state.isInvalidated,
      ).toBe(true);
    }
  });
});
