import { describe, expect, test } from "bun:test";
import { resolvePostThreadContext } from "./postThreadContext";

describe("resolvePostThreadContext", () => {
  test("keeps context-free post pages direct scoped", () => {
    expect(
      resolvePostThreadContext({
        params: { rootPostUnitId: "post-1" },
      }),
    ).toEqual({
      rootPostUnitId: "post-1",
      realmUnitId: null,
      reactionScopeKey: undefined,
    });
  });

  test("uses the route realm id for long realm-context post pages", () => {
    expect(
      resolvePostThreadContext({
        params: { realmId: "realm-1", postUnitId: "post-1" },
      }),
    ).toEqual({
      rootPostUnitId: "post-1",
      realmUnitId: "realm-1",
      reactionScopeKey: "realm:realm-1",
    });
  });

  test("prefers an explicitly resolved slug realm over params", () => {
    expect(
      resolvePostThreadContext({
        params: { realmId: "stale-realm", postUnitId: "post-1" },
        realmUnitId: "resolved-realm",
      }),
    ).toEqual({
      rootPostUnitId: "post-1",
      realmUnitId: "resolved-realm",
      reactionScopeKey: "realm:resolved-realm",
    });
  });
});
