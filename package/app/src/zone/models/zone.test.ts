import { describe, expect, test } from "bun:test";
import { mergeZoneFilters, zoneFiltersToSearchQuery } from "./zone";

describe("zone filter model", () => {
  test("keeps zone base filters as unremovable content search boundaries", () => {
    const options = mergeZoneFilters(
      {
        type: ["BOOK", "MEDIA"],
        tags: [{ scope: "tag", slug: "isekai" }],
        realmUnitId: "realm-unit",
        languages: ["en", "ja"],
        ratings: ["GENERAL", "R_15"],
        isLicensed: true,
      },
      {
        type: ["MEDIA", "POST"],
        tags: [{ slug: "summer" }],
        realmId: "other-realm",
        languages: ["ja", "ko"],
        ratings: ["R_15", "R_18"],
        isLicensed: false,
        keyword: "portal",
      },
    );

    expect(options).toMatchObject({
      type: ["MEDIA"],
      realmId: "realm-unit",
      languages: ["ja"],
      ratings: ["R_15"],
      isLicensed: true,
      keyword: "portal",
    });
    expect(options.tags).toEqual([
      { scope: "tag", slug: "isekai" },
      { slug: "summer" },
    ]);
  });

  test("does not drop a zone boundary when the user filter is disjoint", () => {
    const options = mergeZoneFilters(
      {
        type: "BOOK",
        languages: ["en"],
        ratings: ["GENERAL"],
      },
      {
        type: "MEDIA",
        languages: ["ja"],
        ratings: ["R_18"],
      },
    );

    expect(options.type).toEqual(["BOOK"]);
    expect(options.languages).toEqual(["en"]);
    expect(options.ratings).toEqual(["GENERAL"]);
  });

  test("maps zone filters into implicit search query state", () => {
    expect(
      zoneFiltersToSearchQuery(
        {
          type: "BOOK",
          tags: [{ scope: "tag", slug: "book" }],
          realmUnitId: "realm-unit",
          realmId: "realm-slug",
          languages: ["zh-hant", "unknown"],
          ratings: ["GENERAL"],
          postKind: ["REVIEW"],
          isLicensed: false,
        },
        ["GENERAL", "R_15"],
      ),
    ).toEqual({
      type: ["BOOK"],
      tags: [{ scope: "tag", slug: "book" }],
      realm: { scope: "realm", slug: "realm-slug", unitId: "realm-unit" },
      languages: ["zh-hant"],
      ratings: ["GENERAL"],
      postKind: ["REVIEW"],
      isLicensed: false,
    });
  });
});
