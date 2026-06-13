import { describe, expect, test } from "bun:test";
import { resolvePostDetailContext } from "./postDetailContext";

describe("resolvePostDetailContext", () => {
  test("resolves direct post routes with null reaction context", () => {
    expect(
      resolvePostDetailContext({
        params: { rootPostUnitId: "post-1" },
      }),
    ).toEqual({
      rootPostUnitId: "post-1",
      context: { kind: "direct" },
      realmUnitId: null,
      reactionContextUnitId: null,
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
      reactionContextUnitId: null,
    });
    expect(
      resolvePostDetailContext({
        params: { wikiUnitId: "wiki-1" },
      }),
    ).toEqual({
      rootPostUnitId: "wiki-1",
      context: { kind: "direct" },
      realmUnitId: null,
      reactionContextUnitId: null,
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
      reactionContextUnitId: "realm-1",
    });
  });

  test("falls back to route realm params when no loader context is provided", () => {
    expect(
      resolvePostDetailContext({
        params: { postUnitId: "post-1", realmId: "realm-2" },
      }).reactionContextUnitId,
    ).toBe("realm-2");
  });
});
