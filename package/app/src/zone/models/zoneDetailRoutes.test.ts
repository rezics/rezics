import { describe, expect, test } from "bun:test";
import {
  directPostHref,
  realmPostRoute,
  zoneDetailRoute,
  zoneManageHref,
  zoneRouteBaseHref,
  zoneRouteLocationFromZone,
  zoneSearchHref,
} from "./zoneDetailRoutes";

describe("zone detail route models", () => {
  test("keeps zone-framed, direct, and realm-context post links distinct", () => {
    const zoneRoute = zoneDetailRoute({
      zoneSlug: "book",
      kind: "post",
      unitId: "post-1",
    });
    const realmRoute = realmPostRoute({
      realmUnitId: "realm-1",
      postUnitId: "post-1",
    });

    expect(zoneRoute.href).toBe("/z/book/post/post-1");
    expect(directPostHref("post-1")).toBe("/post/post-1");
    expect(realmRoute.href).toBe("/realm/realm-1/post/post-1");
    expect(zoneRoute.interactionContext).toEqual({ kind: "direct" });
    expect(realmRoute.interactionContext).toEqual({
      kind: "realm",
      realmUnitId: "realm-1",
    });
    expect(realmRoute.presentationContext).toEqual({
      kind: "realm",
      realmUnitId: "realm-1",
      visibility: "visible",
    });
  });

  test("builds parallel zone slug and unitId route locations", () => {
    const slugLocation = zoneRouteLocationFromZone({
      unitId: "zone-1",
      slug: "book",
    });
    const unitLocation = zoneRouteLocationFromZone({
      unitId: "zone-1",
      slug: null,
    });

    expect(zoneRouteBaseHref(slugLocation)).toBe("/z/book");
    expect(zoneRouteBaseHref(unitLocation)).toBe("/zone/zone-1");
    expect(zoneSearchHref(unitLocation)).toBe("/zone/zone-1/search");
    expect(zoneManageHref(unitLocation)).toBe("/zone/zone-1/manage");
    expect(
      zoneDetailRoute({
        location: unitLocation,
        kind: "post",
        unitId: "post-1",
      }),
    ).toEqual({
      href: "/zone/zone-1/post/post-1",
      routeLocation: unitLocation,
      presentationContext: {
        kind: "zone",
        zoneUnitId: "zone-1",
        zoneSlug: null,
        visibility: "visible",
      },
      interactionContext: { kind: "direct" },
    });
  });

  test("builds zone-framed wiki and unit links with zone presentation only", () => {
    expect(
      zoneDetailRoute({ zoneSlug: "wiki", kind: "wiki", unitId: "wiki-1" }),
    ).toEqual({
      href: "/z/wiki/wiki/wiki-1",
      routeLocation: { kind: "slug", zoneSlug: "wiki" },
      presentationContext: {
        kind: "zone",
        zoneUnitId: null,
        zoneSlug: "wiki",
        visibility: "visible",
      },
      interactionContext: { kind: "direct" },
    });
    expect(
      zoneDetailRoute({ zoneSlug: "book", kind: "unit", unitId: "unit-1" }),
    ).toEqual({
      href: "/z/book/unit/unit-1",
      routeLocation: { kind: "slug", zoneSlug: "book" },
      presentationContext: {
        kind: "zone",
        zoneUnitId: null,
        zoneSlug: "book",
        visibility: "visible",
      },
      interactionContext: { kind: "direct" },
    });
  });
});
