import { describe, expect, test } from "bun:test";
import type { UnitDTO } from "@rezics/contract";
import { UnitType } from "@rezics/contract";
import { buildUnitUrl } from "@/shared/utils/build-url";
import {
  isUuidSegment,
  resolveUnitRoute,
  validatePublicUnitResolverSearch,
} from "./unitResolver";

function unit(type: string, overrides: Partial<UnitDTO> = {}): UnitDTO {
  return {
    id: "fixture-id",
    type,
    visibility: "PUBLIC",
    ...overrides,
  } as UnitDTO;
}

describe("unit resolver — buildUnitUrl coverage", () => {
  test.each(
    Object.values(UnitType),
  )("%s resolves without revisiting legacy /unit/:id", (type) => {
    const typedUrl = buildUnitUrl(unit(type));
    expect(typedUrl).not.toBe("/unit/fixture-id");
  });

  test("generic fallback prefers public Unit slug routes", () => {
    expect(buildUnitUrl(unit("LINK", { slug: "linked-source" }))).toBe(
      "/unit/linked-source",
    );
  });

  test("generic fallback keeps id route for Units without slugs", () => {
    expect(buildUnitUrl(unit("LINK"))).toBe("/unit/id/fixture-id");
  });

  test("typed routes without canonical slug routes stay on id compatibility URLs", () => {
    expect(buildUnitUrl(unit("REALM", { slug: "realm-a" }))).toBe(
      "/realm/fixture-id",
    );
    expect(buildUnitUrl(unit("TAG", { slug: "tag-a" }))).toBe(
      "/tag/fixture-id",
    );
  });
});

describe("public Unit resolver search", () => {
  test("omitted view defaults to auto", () => {
    expect(validatePublicUnitResolverSearch({})).toEqual({ view: "auto" });
  });

  test("view=unit suppresses typed redirects", () => {
    expect(
      resolveUnitRoute({
        unit: unit("BOOK"),
        viewer: null,
        view: "unit",
      }),
    ).toEqual({ unit: unit("BOOK") });
  });

  test("view=auto redirects to typed routes when available", () => {
    expect(() =>
      resolveUnitRoute({
        unit: unit("BOOK"),
        viewer: null,
        view: "auto",
      }),
    ).toThrow();
  });

  test("missing Units return not found", () => {
    expect(() =>
      resolveUnitRoute({
        unit: null,
        viewer: null,
        view: "unit",
      }),
    ).toThrow();
  });

  test("invalid view is rejected", () => {
    expect(() => validatePublicUnitResolverSearch({ view: "raw" })).toThrow();
  });

  test("UUID-shaped legacy Unit routes are distinguishable for migration", () => {
    expect(isUuidSegment("018f1111-2222-4333-8444-555555555555")).toBe(true);
    expect(isUuidSegment("018f-valid-looking-id")).toBe(false);
  });
});
