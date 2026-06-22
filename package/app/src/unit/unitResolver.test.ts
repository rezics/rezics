import { describe, expect, test } from "bun:test";
import type { UnitDTO } from "@rezics/contract";
import { UnitType } from "@rezics/contract";
import { unitHrefFromPartial } from "@/shared/ui/link";
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

const ROUTABLE_TYPES = [
  "BOOK", "POST", "QUOTE", "POLL", "SHELF",
  "USER", "REALM", "TAG", "ZONE", "ENTITY",
] as const;

describe("unitHrefFromPartial coverage", () => {
  test.each(ROUTABLE_TYPES)("%s resolves without /unit/:id fallback", (type) => {
    const url = unitHrefFromPartial(type, "fixture-id");
    expect(url).not.toBe("/unit/fixture-id");
  });

  test("unknown type falls back to /unit/:id", () => {
    expect(unitHrefFromPartial("LINK", "fixture-id")).toBe("/unit/fixture-id");
  });

  test("slug-bearing types with slug prefer the short-prefix slug URL", () => {
    expect(unitHrefFromPartial("REALM", "fixture-id", "realm-a")).toBe("/r/realm-a");
    expect(unitHrefFromPartial("TAG", "fixture-id", "tag-a")).toBe("/t/tag-a");
  });

  test("slug-bearing types without slug fall back to long-prefix unitId URLs", () => {
    expect(unitHrefFromPartial("REALM", "fixture-id")).toBe("/realm/fixture-id");
    expect(unitHrefFromPartial("TAG", "fixture-id")).toBe("/tag/fixture-id");
  });

  test("ID-only types always use their prefix", () => {
    expect(unitHrefFromPartial("BOOK", "fixture-id")).toBe("/book/fixture-id");
    expect(unitHrefFromPartial("POST", "fixture-id")).toBe("/post/fixture-id");
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

  test("UUID-shaped Unit route segments are distinguishable for migration", () => {
    expect(isUuidSegment("018f1111-2222-4333-8444-555555555555")).toBe(true);
    expect(isUuidSegment("018f-valid-looking-id")).toBe(false);
  });
});
