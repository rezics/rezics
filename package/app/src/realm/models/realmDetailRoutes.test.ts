import { describe, expect, test } from "bun:test";
import {
  isRealmUnitIdParam,
  realmCreateHref,
  realmDetailHref,
  realmDetailLocationFromSlugParams,
  realmManageHref,
  realmSearchHref,
  realmSummaryHref,
} from "./realmDetailRoutes";

describe("realm detail route helpers", () => {
  test("keeps slug-bearing realm detail links on the canonical /r route", () => {
    const location = realmDetailLocationFromSlugParams({
      realmSlug: "rezics",
    });

    expect(realmDetailHref(location)).toBe("/r/rezics");
    expect(realmDetailHref(location, "tags")).toBe("/r/rezics/tags");
    expect(realmManageHref(location)).toBe("/r/rezics/manage");
    expect(realmCreateHref(location)).toBe("/r/rezics/create");
    expect(realmSearchHref(location)).toBe("/r/rezics/search");
  });

  test("falls back to the long /realm route when only a unit id is available", () => {
    const location = {
      kind: "unitId" as const,
      realmId: "018f9326-8d80-7b86-bc9f-ccceec9a43f5",
    };

    expect(realmDetailHref(location)).toBe(
      "/realm/018f9326-8d80-7b86-bc9f-ccceec9a43f5",
    );
    expect(realmDetailHref(location, "dock")).toBe(
      "/realm/018f9326-8d80-7b86-bc9f-ccceec9a43f5/dock",
    );
  });

  test("realm summaries prefer slug links when available", () => {
    expect(
      realmSummaryHref({
        realmId: "018f9326-8d80-7b86-bc9f-ccceec9a43f5",
        slug: "sci-fi-readers",
      }),
    ).toBe("/r/sci-fi-readers");
    expect(
      realmSummaryHref({
        realmId: "018f9326-8d80-7b86-bc9f-ccceec9a43f5",
        slug: null,
      }),
    ).toBe("/realm/018f9326-8d80-7b86-bc9f-ccceec9a43f5");
  });

  test("long realm route params reject slug-shaped values", () => {
    expect(isRealmUnitIdParam("rezics")).toBe(false);
    expect(isRealmUnitIdParam("018f9326-8d80-7b86-bc9f-ccceec9a43f5")).toBe(
      true,
    );
  });
});
