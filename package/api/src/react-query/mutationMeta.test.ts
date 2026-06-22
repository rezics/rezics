import { describe, expect, spyOn, test } from "bun:test";
import { createQueryClient } from "./tsr";

// Proves the global `MutationCache.onSuccess` handler turns a mutation's
// declarative `meta.invalidates` into real `invalidateQueries` calls. Before
// the handler existed this suite fails (no invalidation happens from meta);
// after, it passes. This is the single mechanism every migrated mutation
// relies on instead of hand-writing `useQueryClient()` + `onSuccess`.
// 证明全局 `MutationCache.onSuccess` handler 把 mutation 的声明式
// `meta.invalidates` 转化为真实的 `invalidateQueries` 调用。在该 handler
// 存在之前本套件必挂（meta 不会触发任何失效）；之后必过。这是每个被收敛的
// mutation 所依赖的唯一机制，取代手写 `useQueryClient()` + `onSuccess`。
describe("createQueryClient mutation meta invalidation", () => {
  test("invalidates each query-key prefix declared in meta.invalidates", async () => {
    const qc = createQueryClient();
    const spy = spyOn(qc, "invalidateQueries");

    const mutation = qc.getMutationCache().build(qc, {
      mutationFn: async () => "ok",
      meta: { invalidates: [["books"], ["users", "by-id", "42"]] },
    });
    await mutation.execute(undefined);

    expect(spy).toHaveBeenCalledWith({ queryKey: ["books"] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ["users", "by-id", "42"] });
    expect(spy).toHaveBeenCalledTimes(2);
  });

  test("does nothing when a mutation declares no meta.invalidates", async () => {
    const qc = createQueryClient();
    const spy = spyOn(qc, "invalidateQueries");

    const mutation = qc.getMutationCache().build(qc, {
      mutationFn: async () => "ok",
    });
    await mutation.execute(undefined);

    expect(spy).not.toHaveBeenCalled();
  });

  test("runs invalidations only after the mutation resolves, not on failure", async () => {
    const qc = createQueryClient();
    const spy = spyOn(qc, "invalidateQueries");

    const mutation = qc.getMutationCache().build(qc, {
      mutationFn: async () => {
        throw new Error("boom");
      },
      meta: { invalidates: [["books"]] },
    });

    await expect(mutation.execute(undefined)).rejects.toThrow("boom");
    expect(spy).not.toHaveBeenCalled();
  });
});
