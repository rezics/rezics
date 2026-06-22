import { describe, expect, test } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { realmKeys } from "./realm.keys";
import { syncRealmMembershipMutationCache } from "./realm.mutations";

describe("realm membership mutation cache sync", () => {
  test("invalidates members, detail, and exact mine queries after membership changes", async () => {
    const queryClient = new QueryClient();
    const exactMineKey = realmKeys.mine();
    const membershipKey = realmKeys.members("realm-1");
    const detailKey = realmKeys.detail("realm-1");

    // ponytail: language-aware mine keys (e.g. realmKeys.mine({ languages }))
    // are covered by the broader meta.invalidates on the calling hooks, not by
    // this helper — the helper targets exact realm keys while meta fires the
    // ["realms"] root prefix that subsumes all variants.
    // ponytail: 语言感知的 mine key 由调用方 hook 的 meta.invalidates 覆盖，
    // 不由此辅助函数负责——辅助函数精确定位 realm key，meta 触发 ["realms"]
    // 根前缀涵盖所有变体。

    for (const queryKey of [exactMineKey, membershipKey, detailKey]) {
      queryClient.setQueryData(queryKey, {});
    }

    await syncRealmMembershipMutationCache({
      queryClient,
      realmUnitId: "realm-1",
    });

    for (const queryKey of [exactMineKey, membershipKey, detailKey]) {
      expect(
        queryClient.getQueryCache().find({ queryKey })?.state.isInvalidated,
      ).toBe(true);
    }
  });
});
