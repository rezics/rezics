import { describe, expect, test } from "bun:test";

import { unitHref } from "./unitHref";

describe("unitHref", () => {
  describe("USER", () => {
    test("with slug renders /u/<slug>", () => {
      expect(unitHref({ type: "USER", unitId: "u-1", slug: "alice" })).toBe(
        "/u/alice",
      );
    });

    test("without slug renders /user/<unitId>", () => {
      expect(unitHref({ type: "USER", unitId: "u-1", slug: null })).toBe(
        "/user/u-1",
      );
    });

    test("with undefined slug renders /user/<unitId>", () => {
      expect(unitHref({ type: "USER", unitId: "u-1", slug: undefined })).toBe(
        "/user/u-1",
      );
    });
  });

  describe("REALM", () => {
    test("with slug renders /r/<slug>", () => {
      expect(unitHref({ type: "REALM", unitId: "r-9", slug: "rezics" })).toBe(
        "/r/rezics",
      );
    });

    test("without slug renders /realm/<unitId>", () => {
      expect(unitHref({ type: "REALM", unitId: "r-9", slug: null })).toBe(
        "/realm/r-9",
      );
    });
  });

  describe("TAG", () => {
    test("with slug renders /t/<slug>", () => {
      expect(unitHref({ type: "TAG", unitId: "t-3", slug: "sci-fi" })).toBe(
        "/t/sci-fi",
      );
    });

    test("without slug renders /tag/<unitId>", () => {
      expect(unitHref({ type: "TAG", unitId: "t-3", slug: null })).toBe(
        "/tag/t-3",
      );
    });
  });

  describe("ZONE", () => {
    test("with slug renders /z/<slug>", () => {
      expect(unitHref({ type: "ZONE", unitId: "z-2", slug: "drift" })).toBe(
        "/z/drift",
      );
    });

    test("without slug renders /zone/<unitId>", () => {
      expect(unitHref({ type: "ZONE", unitId: "z-2", slug: null })).toBe(
        "/zone/z-2",
      );
    });
  });

  describe("ENTITY", () => {
    test("with slug renders /e/<slug>", () => {
      expect(unitHref({ type: "ENTITY", unitId: "e-4", slug: "calvino" })).toBe(
        "/e/calvino",
      );
    });

    test("without slug renders /entity/<unitId>", () => {
      expect(unitHref({ type: "ENTITY", unitId: "e-4", slug: null })).toBe(
        "/entity/e-4",
      );
    });
  });

  describe("SHELF", () => {
    test("owner slug + shelf slug renders /u/<ownerSlug>/shelf/<shelfSlug>", () => {
      expect(
        unitHref({
          type: "SHELF",
          ownerType: "USER",
          ownerSlug: "alice",
          ownerUnitId: "u-1",
          unitId: "s-7",
          slug: "favorites",
        }),
      ).toBe("/u/alice/shelf/favorites");
    });

    test("realm-owner slug + shelf slug renders /r/<ownerSlug>/shelf/<shelfSlug>", () => {
      expect(
        unitHref({
          type: "SHELF",
          ownerType: "REALM",
          ownerSlug: "rezics",
          ownerUnitId: "r-9",
          unitId: "s-7",
          slug: "featured",
        }),
      ).toBe("/r/rezics/shelf/featured");
    });

    test("owner slug + null shelf slug falls back to /shelf/<unitId>", () => {
      expect(
        unitHref({
          type: "SHELF",
          ownerType: "USER",
          ownerSlug: "alice",
          ownerUnitId: "u-1",
          unitId: "s-7",
          slug: null,
        }),
      ).toBe("/shelf/s-7");
    });

    test("null owner slug + shelf slug falls back to /shelf/<unitId>", () => {
      expect(
        unitHref({
          type: "SHELF",
          ownerType: "USER",
          ownerSlug: null,
          ownerUnitId: "u-1",
          unitId: "s-7",
          slug: "favorites",
        }),
      ).toBe("/shelf/s-7");
    });

    test("null owner slug + null shelf slug falls back to /shelf/<unitId>", () => {
      expect(
        unitHref({
          type: "SHELF",
          ownerType: "USER",
          ownerSlug: null,
          ownerUnitId: "u-1",
          unitId: "s-7",
          slug: null,
        }),
      ).toBe("/shelf/s-7");
    });
  });
});
