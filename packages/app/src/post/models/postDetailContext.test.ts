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
      interactionContext: { kind: "direct" },
      presentationContext: {
        kind: "unit",
        unitKind: "post",
        unitId: "post-1",
        visibility: "hidden",
      },
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
      interactionContext: { kind: "direct" },
      presentationContext: {
        kind: "unit",
        unitKind: "post",
        unitId: "post-1",
        visibility: "hidden",
      },
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
      interactionContext: { kind: "direct" },
      presentationContext: {
        kind: "unit",
        unitKind: "post",
        unitId: "wiki-1",
        visibility: "hidden",
      },
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
      interactionContext: { kind: "realm", realmUnitId: "realm-1" },
      presentationContext: {
        kind: "realm",
        realmUnitId: "realm-1",
        visibility: "visible",
      },
      realmUnitId: "realm-1",
      reactionContextUnitId: "realm-1",
    });
  });

  test("keeps zone presentation separate from direct interaction context", () => {
    expect(
      resolvePostDetailContext({
        params: { postUnitId: "post-1" },
        presentationContext: {
          kind: "zone",
          zoneUnitId: "zone-1",
          zoneSlug: "book",
          visibility: "visible",
        },
      }),
    ).toEqual({
      rootPostUnitId: "post-1",
      context: { kind: "direct" },
      interactionContext: { kind: "direct" },
      presentationContext: {
        kind: "zone",
        zoneUnitId: "zone-1",
        zoneSlug: "book",
        visibility: "visible",
      },
      realmUnitId: null,
      reactionContextUnitId: null,
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
