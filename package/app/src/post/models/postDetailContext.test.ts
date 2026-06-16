import { describe, expect, test } from "bun:test";
import { resolvePostDetailContext } from "./postDetailContext";

describe("resolvePostDetailContext", () => {
  test("resolves direct post routes without a scoped reaction key", () => {
    expect(
      resolvePostDetailContext({
        params: { rootPostUnitId: "post-1" },
      }),
    ).toEqual({
      rootPostUnitId: "post-1",
      context: { kind: "direct" },
      realmUnitId: null,
      reactionScopeKey: undefined,
    });
  });

  test("resolves zone-framed post and wiki routes as direct interaction context", () => {
    expect(
      resolvePostDetailContext({
        params: { postUnitId: "post-1" },
      }),
    ).toEqual({
      rootPostUnitId: "post-1",
      context: { kind: "direct" },
      realmUnitId: null,
      reactionScopeKey: undefined,
    });
    expect(
      resolvePostDetailContext({
        params: { wikiUnitId: "wiki-1" },
      }),
    ).toEqual({
      rootPostUnitId: "wiki-1",
      context: { kind: "direct" },
      realmUnitId: null,
      reactionScopeKey: undefined,
    });
  });

  test("uses explicit realm context for realm post routes", () => {
    expect(
      resolvePostDetailContext({
        params: { postUnitId: "post-1" },
        realmUnitId: "realm-1",
      }),
    ).toEqual({
      rootPostUnitId: "post-1",
      context: { kind: "realm", realmUnitId: "realm-1" },
      realmUnitId: "realm-1",
      reactionScopeKey: "realm:realm-1",
    });
  });

  test("falls back to route realm params when no loader context is provided", () => {
    expect(
      resolvePostDetailContext({
        params: { postUnitId: "post-1", realmId: "realm-2" },
      }).reactionScopeKey,
    ).toBe("realm:realm-2");
  });
});
