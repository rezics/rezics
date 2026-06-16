import { describe, expect, test } from "bun:test";
import {
  directPostHref,
  realmPostRoute,
  zoneDetailRoute,
} from "./zoneDetailRoutes";

describe("zone detail route models", () => {
  test("keeps zone-framed, direct, and realm-context post links distinct", () => {
    const zoneRoute = zoneDetailRoute({
      zoneSlug: "book",
      kind: "post",
      unitId: "post-1",
    });
    const realmRoute = realmPostRoute({
      realmId: "realm-1",
      postUnitId: "post-1",
    });

    expect(zoneRoute.href).toBe("/z/book/post/post-1");
    expect(directPostHref("post-1")).toBe("/post/post-1");
    expect(realmRoute.href).toBe("/realm/realm-1/post/post-1");
    expect(zoneRoute.interactionContext).toEqual({ kind: "direct" });
    expect(realmRoute.interactionContext).toEqual({
      kind: "realm",
      realmId: "realm-1",
    });
  });

  test("builds zone-framed wiki and unit links with zone presentation only", () => {
    expect(
      zoneDetailRoute({ zoneSlug: "wiki", kind: "wiki", unitId: "wiki-1" }),
    ).toEqual({
      href: "/z/wiki/wiki/wiki-1",
      presentationContext: { kind: "zone", zoneSlug: "wiki" },
      interactionContext: { kind: "direct" },
    });
    expect(
      zoneDetailRoute({ zoneSlug: "book", kind: "unit", unitId: "unit-1" }),
    ).toEqual({
      href: "/z/book/unit/unit-1",
      presentationContext: { kind: "zone", zoneSlug: "book" },
      interactionContext: { kind: "direct" },
    });
  });
});
