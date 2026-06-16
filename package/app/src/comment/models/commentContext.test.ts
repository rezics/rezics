import { describe, expect, it } from "bun:test";
import {
  buildCommentContextRealmOptions,
  COMMENT_CONTEXT_ALL,
  COMMENT_CONTEXT_ALL_OPTION_VALUE,
  commentContextFromOptionValue,
  commentContextToOptionValue,
  decideCommentContextBadge,
  resolveDefaultCommentContext,
  toCommentWriteRealmUnitId,
} from "./commentContext";

describe("resolveDefaultCommentContext", () => {
  it("defaults a zone surface with a realm context to that realm", () => {
    expect(
      resolveDefaultCommentContext({
        kind: "zone",
        zoneContext: { kind: "realm", realmUnitId: "realm-1" },
      }),
    ).toEqual({ kind: "realm", realmUnitId: "realm-1" });
  });

  it("defaults a global-context zone surface to All", () => {
    expect(
      resolveDefaultCommentContext({
        kind: "zone",
        zoneContext: { kind: "global" },
      }),
    ).toEqual({ kind: "all" });
  });

  it("defaults a zone surface to All while its config has not loaded", () => {
    expect(
      resolveDefaultCommentContext({ kind: "zone", zoneContext: undefined }),
    ).toEqual({ kind: "all" });
  });

  it("defaults a realm route to that realm", () => {
    expect(
      resolveDefaultCommentContext({ kind: "realm", realmUnitId: "realm-2" }),
    ).toEqual({ kind: "realm", realmUnitId: "realm-2" });
  });

  it("defaults a direct unit route to All", () => {
    expect(resolveDefaultCommentContext({ kind: "direct" })).toEqual({
      kind: "all",
    });
  });

  it("defaults a hidden post self-context to All", () => {
    expect(
      resolveDefaultCommentContext({
        kind: "unit",
        presentationContext: {
          kind: "unit",
          unitKind: "post",
          unitId: "post-1",
          visibility: "hidden",
        },
        interactionContext: { kind: "direct" },
      }),
    ).toEqual({ kind: "all" });
  });

  it("defaults a unit surface with realm interaction to that realm", () => {
    expect(
      resolveDefaultCommentContext({
        kind: "unit",
        presentationContext: {
          kind: "zone",
          zoneUnitId: "zone-1",
          zoneSlug: null,
          visibility: "visible",
        },
        interactionContext: { kind: "realm", realmUnitId: "realm-3" },
      }),
    ).toEqual({ kind: "realm", realmUnitId: "realm-3" });
  });
});

describe("buildCommentContextRealmOptions", () => {
  it("pins the surface context realm first and de-duplicates", () => {
    expect(
      buildCommentContextRealmOptions({
        pinnedRealmUnitId: "realm-zone",
        knownRealmUnitIds: ["realm-a", "realm-zone"],
        observedRealmUnitIds: ["realm-b", "realm-a", null, undefined],
      }),
    ).toEqual(["realm-zone", "realm-a", "realm-b"]);
  });

  it("never emits a direct option (null/undefined ids are dropped)", () => {
    expect(
      buildCommentContextRealmOptions({
        pinnedRealmUnitId: null,
        observedRealmUnitIds: [null, undefined],
      }),
    ).toEqual([]);
  });

  it("keeps observed realm order after known realms", () => {
    expect(
      buildCommentContextRealmOptions({
        knownRealmUnitIds: ["realm-known"],
        observedRealmUnitIds: ["realm-1", "realm-2"],
      }),
    ).toEqual(["realm-known", "realm-1", "realm-2"]);
  });
});

describe("option value round trip", () => {
  it("encodes All to the sentinel value and back", () => {
    expect(commentContextToOptionValue(COMMENT_CONTEXT_ALL)).toBe(
      COMMENT_CONTEXT_ALL_OPTION_VALUE,
    );
    expect(
      commentContextFromOptionValue(COMMENT_CONTEXT_ALL_OPTION_VALUE),
    ).toEqual({ kind: "all" });
  });

  it("encodes a realm context to its realm unit id and back", () => {
    expect(
      commentContextToOptionValue({ kind: "realm", realmUnitId: "realm-1" }),
    ).toBe("realm-1");
    expect(commentContextFromOptionValue("realm-1")).toEqual({
      kind: "realm",
      realmUnitId: "realm-1",
    });
  });
});

describe("toCommentWriteRealmUnitId", () => {
  it("maps All to a direct comment (null)", () => {
    expect(toCommentWriteRealmUnitId({ kind: "all" })).toBeNull();
  });

  it("maps the direct API context to null as well", () => {
    expect(toCommentWriteRealmUnitId({ kind: "direct" })).toBeNull();
  });

  it("maps a realm context to that realm unit id", () => {
    expect(
      toCommentWriteRealmUnitId({ kind: "realm", realmUnitId: "realm-9" }),
    ).toBe("realm-9");
  });
});

describe("decideCommentContextBadge", () => {
  it("badges realm-context comments in the All view", () => {
    expect(
      decideCommentContextBadge({
        viewContext: { kind: "all" },
        commentRealmUnitId: "realm-1",
      }),
    ).toEqual({ kind: "realm", realmUnitId: "realm-1" });
  });

  it("badges direct comments in the All view", () => {
    expect(
      decideCommentContextBadge({
        viewContext: { kind: "all" },
        commentRealmUnitId: null,
      }),
    ).toEqual({ kind: "direct" });
  });

  it("never badges inside a single-realm view", () => {
    expect(
      decideCommentContextBadge({
        viewContext: { kind: "realm", realmUnitId: "realm-1" },
        commentRealmUnitId: "realm-1",
      }),
    ).toBeNull();
  });

  it("never badges inside the direct API view", () => {
    expect(
      decideCommentContextBadge({
        viewContext: { kind: "direct" },
        commentRealmUnitId: null,
      }),
    ).toBeNull();
  });
});
