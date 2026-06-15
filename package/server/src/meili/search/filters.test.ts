import { describe, expect, test } from "bun:test";
import type { SearchQuery, SearchScope } from "@rezics/contract";
import {
  buildCommentFilter,
  buildContentFilter,
  buildPostFilter,
  buildRealmFilter,
  buildShelfItemFilter,
  buildUserFilter,
  compileZoneSectionQuery,
  zoneSectionQueryUnsupportedFields,
} from "./filters";

const emptyQuery: SearchQuery = {};

describe("buildContentFilter", () => {
  test("global scope with bare query yields visibility default", () => {
    const filter = buildContentFilter(emptyQuery, { kind: "global" });
    expect(filter).toEqual(['visibility = "PUBLIC"']);
  });

  test("book scope with shelves subtype emits SHELF type + containedUnitIds", () => {
    const scope: SearchScope = { kind: "book", unitId: "b-1" };
    const filter = buildContentFilter(
      emptyQuery,
      scope,
      {},
      {
        contentSubtype: "shelves",
      },
    );
    expect(filter).toContain('type = "SHELF"');
    expect(filter).toContain('containedUnitIds = "b-1"');
  });

  test("realm scope emits realmIds filter", () => {
    const scope: SearchScope = { kind: "realm", realmId: "r-7" };
    const filter = buildContentFilter(emptyQuery, scope);
    expect(filter).toContain('realmIds = "r-7"');
  });

  test("zone scope relies on query filters instead of index membership", () => {
    const scope: SearchScope = { kind: "zone", zoneUnitId: "zone-1" };
    const filter = buildContentFilter({ type: ["BOOK"] }, scope);
    expect(filter).toContain('type = "BOOK"');
    expect(filter).toContain('visibility = "PUBLIC"');
    expect(filter).not.toContain('realmIds = "zone-1"');
    expect(filter).not.toContain('zoneUnitId = "zone-1"');
  });

  test("user scope emits userId filter", () => {
    const scope: SearchScope = { kind: "user", userId: "u-3" };
    const filter = buildContentFilter(emptyQuery, scope);
    expect(filter).toContain('userId = "u-3"');
  });

  test("ratings: requested intersected with allowed", () => {
    const filter = buildContentFilter(
      { ratings: ["GENERAL", "R_18"] },
      { kind: "global" },
      { allowedRatings: ["GENERAL", "R_15"] },
    );
    expect(filter).toContain('rating IN ["GENERAL"]');
  });

  test("AI disclosure filter is independent from allowed rating derivation", () => {
    const filter = buildContentFilter(
      { aiDisclosureModes: ["AI_ASSISTED"] },
      { kind: "global" },
      { allowedRatings: ["GENERAL", "R_15"] },
    );

    expect(filter).toContain('aiDisclosureMode IN ["AI_ASSISTED"]');
    expect(filter).toContain('rating IN ["GENERAL", "R_15"]');
  });

  test("languages list emits any-of filter", () => {
    const filter = buildContentFilter(
      { languages: ["en", "ja"] },
      { kind: "global" },
    );
    expect(filter).toContain(
      '(isLanguageNeutral = true OR languages IN ["en", "ja"])',
    );
    expect(filter).not.toContain('languages = "en"');
    expect(filter).not.toContain('languages = "ja"');
  });

  test("languageMode all skips preferred filtering", () => {
    const filter = buildContentFilter(
      { languages: ["en"], languageMode: "all" },
      { kind: "global" },
    );
    expect(filter).not.toContain(
      '(isLanguageNeutral = true OR languages IN ["en"])',
    );
  });

  test("textLength range emits min and max bounds", () => {
    const filter = buildContentFilter(
      { textLength: { min: 1000, max: 50000 } },
      { kind: "global" },
    );
    expect(filter).toContain("textLength >= 1000");
    expect(filter).toContain("textLength <= 50000");
  });

  test("isLicensed=true emits the license filter", () => {
    const filter = buildContentFilter({ isLicensed: true }, { kind: "global" });
    expect(filter).toContain("isLicensed = true");
  });

  test("type list emits IN clause when contentSubtype is absent", () => {
    const filter = buildContentFilter(
      { type: ["BOOK", "GAME"] },
      { kind: "global" },
    );
    expect(filter).toContain('type IN ["BOOK", "GAME"]');
  });

  test("books subtype includes main catalog entries plus non-edition content", () => {
    const filter = buildContentFilter(
      emptyQuery,
      { kind: "global" },
      {},
      { contentSubtype: "books" },
    );

    expect(filter).toContain(
      'type IN ["BOOK", "GAME", "MEDIA", "LINK", "SERIES"]',
    );
    expect(filter).toContain(
      '((type = "BOOK" AND catalogEntryKind = "MAIN") OR (type = "GAME" AND catalogEntryKind = "MAIN") OR (type = "MEDIA" AND catalogEntryKind = "MAIN") OR type = "LINK" OR type = "SERIES")',
    );
  });
});

describe("buildPostFilter", () => {
  test("postCategory wins over query.kind", () => {
    const filter = buildPostFilter(
      { kind: "POST" },
      { kind: "global" },
      {},
      { postCategory: "reviews" },
    );
    expect(filter).toContain('kind = "REVIEW"');
    expect(filter).not.toContain('kind = "POST"');
  });

  test("book scope emits targetUnitId", () => {
    const filter = buildPostFilter(emptyQuery, { kind: "book", unitId: "b-2" });
    expect(filter).toContain('targetUnitId = "b-2"');
  });

  test("realm scope emits realmIds", () => {
    const filter = buildPostFilter(emptyQuery, {
      kind: "realm",
      realmId: "r-9",
    });
    expect(filter).toContain('realmIds = "r-9"');
  });

  test("zone scope does not map posts to realm membership", () => {
    const filter = buildPostFilter(emptyQuery, {
      kind: "zone",
      zoneUnitId: "zone-1",
    });
    expect(filter).toContain("isLocked = false");
    expect(filter).not.toContain('realmIds = "zone-1"');
  });

  test("user scope emits authorUserId", () => {
    const filter = buildPostFilter(emptyQuery, { kind: "user", userId: "u-5" });
    expect(filter).toContain('authorUserId = "u-5"');
  });

  test("isLocked=false default is always present", () => {
    const filter = buildPostFilter(emptyQuery, { kind: "global" });
    expect(filter).toContain("isLocked = false");
  });

  test("preferred language filter includes neutral posts", () => {
    const filter = buildPostFilter(
      { languages: ["ja"], appLocale: "en" },
      { kind: "global" },
    );
    expect(filter).toContain(
      '(isLanguageNeutral = true OR languages IN ["en", "ja"])',
    );
  });

  test("query.postKind list emits IN clause when no postCategory hint", () => {
    const filter = buildPostFilter(
      { postKind: ["REVIEW", "REMARK"] },
      { kind: "global" },
    );
    expect(filter).toContain('kind IN ["REVIEW", "REMARK"]');
  });
});

describe("buildCommentFilter", () => {
  test("book exact scope emits rootUnitId", () => {
    const filter = buildCommentFilter(emptyQuery, {
      kind: "book",
      unitId: "book-1",
    });
    expect(filter).toContain('rootUnitId = "book-1"');
    expect(filter).toContain("isLocked = false");
  });

  test("realm and user scopes map to comment partition fields", () => {
    expect(
      buildCommentFilter(emptyQuery, { kind: "realm", realmId: "realm-1" }),
    ).toContain('realmUnitId = "realm-1"');
    expect(
      buildCommentFilter(emptyQuery, { kind: "user", userId: "user-1" }),
    ).toContain('authorUserId = "user-1"');
  });

  test("zone scope does not map comments to realm partition", () => {
    const filter = buildCommentFilter(emptyQuery, {
      kind: "zone",
      zoneUnitId: "zone-1",
    });
    expect(filter).toEqual(["isLocked = false"]);
  });
});

describe("buildRealmFilter", () => {
  test("emits isPublic=true regardless of scope", () => {
    expect(buildRealmFilter(emptyQuery, { kind: "global" })).toEqual([
      "isPublic = true",
    ]);
  });

  test("preferred language filter includes neutral realms", () => {
    expect(buildRealmFilter({ languages: ["ko"] }, { kind: "global" })).toEqual(
      ["isPublic = true", '(isLanguageNeutral = true OR languages IN ["ko"])'],
    );
  });
});

describe("buildUserFilter", () => {
  test("emits no filter for global scope", () => {
    expect(buildUserFilter(emptyQuery, { kind: "global" })).toEqual([]);
  });
});

describe("buildShelfItemFilter", () => {
  test("anonymous global search is public shelves only", () => {
    expect(buildShelfItemFilter(emptyQuery, { kind: "global" })).toEqual([
      '(shelfVisibility = "PUBLIC" AND shelfStatus = "PUBLISHED")',
    ]);
  });

  test("owner user scope includes private shelves", () => {
    expect(
      buildShelfItemFilter(
        emptyQuery,
        { kind: "user", userId: "owner-1" },
        { viewerUserId: "owner-1" },
      ),
    ).toEqual(['shelfOwnerUserId = "owner-1"']);
  });

  test("book scope constrains item identity", () => {
    const filter = buildShelfItemFilter(emptyQuery, {
      kind: "book",
      unitId: "book-1",
    });

    expect(filter).toContain('itemType = "unit"');
    expect(filter).toContain('itemId = "book-1"');
  });

  test("zone scope keeps public shelf visibility without realm membership", () => {
    const filter = buildShelfItemFilter(emptyQuery, {
      kind: "zone",
      zoneUnitId: "zone-1",
    });

    expect(filter).toEqual([
      '(shelfVisibility = "PUBLIC" AND shelfStatus = "PUBLISHED")',
    ]);
  });

  test("saved scope constrains to the user's saved shelf items", () => {
    const filter = buildShelfItemFilter(
      emptyQuery,
      { kind: "saved", shelfId: "saved-shelf-1", userId: "user-1" },
      { viewerUserId: "user-1" },
    );

    expect(filter).toEqual([
      'shelfId = "saved-shelf-1"',
      'shelfOwnerUserId = "user-1"',
      'itemType = "unit"',
      'kind = "shelf"',
    ]);
  });

  test("public saved scope cannot search a private saved shelf", () => {
    const filter = buildShelfItemFilter(emptyQuery, {
      kind: "saved",
      shelfId: "saved-shelf-1",
      userId: "user-1",
    });

    expect(filter).toContain(
      '(shelfVisibility = "PUBLIC" AND shelfStatus = "PUBLISHED")',
    );
  });
});

describe("compileZoneSectionQuery", () => {
  test("compiles a unit query with context realm and viewer languages", () => {
    const compiled = compileZoneSectionQuery(
      {
        target: "unit",
        types: ["BOOK"],
        realm: "context",
        languages: "viewer",
        sort: { field: "publishedAt", direction: "desc" },
      },
      undefined,
      {
        contextRealmUnitId: "realm-1",
        viewerLanguageCandidates: ["zh-hant", "en"],
      },
    );
    expect(compiled.index).toBe("content");
    expect(compiled.filter).toContain('type = "BOOK"');
    expect(compiled.filter).toContain('realmIds = "realm-1"');
    expect(compiled.filter).toContain(
      '(isLanguageNeutral = true OR languages IN ["zh-hant", "en"])',
    );
    // UNLISTED units never reach the index; PUBLIC documents the boundary
    expect(compiled.filter).toContain('visibility = "PUBLIC"');
    expect(compiled.sort).toEqual(["publishedAt:desc"]);
  });

  test("compiles a post query with kind and lock defaults", () => {
    const compiled = compileZoneSectionQuery(
      {
        target: "post",
        postKinds: ["WIKI"],
        realm: "context",
        sort: { field: "updatedAt" },
      },
      undefined,
      { contextRealmUnitId: "realm-1" },
    );
    expect(compiled.index).toBe("posts");
    expect(compiled.filter).toContain('kind = "WIKI"');
    expect(compiled.filter).toContain("isLocked = false");
    expect(compiled.sort).toEqual(["updatedAt:desc"]);
  });

  test("compiles a realm query against the realms index", () => {
    const compiled = compileZoneSectionQuery(
      {
        target: "realm",
        types: ["REALM"],
        languages: "viewer",
        sort: { field: "memberCount", direction: "desc" },
      },
      { types: ["REALM"] },
      { viewerLanguageCandidates: ["en", "ja"] },
    );

    expect(compiled.index).toBe("realms");
    expect(compiled.filter).toContain("isPublic = true");
    expect(compiled.filter).toContain(
      '(isLanguageNeutral = true OR languages IN ["en", "ja"])',
    );
    expect(compiled.filter.some((clause) => clause.startsWith("type"))).toBe(
      false,
    );
    expect(compiled.filter).not.toContain('visibility = "PUBLIC"');
    expect(compiled.sort).toEqual(["memberCount:desc"]);
  });

  test("realm queries cannot widen an incompatible zone boundary", () => {
    const compiled = compileZoneSectionQuery(
      {
        target: "realm",
        types: ["REALM"],
        sort: { field: "updatedAt" },
      },
      { types: ["BOOK"] },
      {},
    );

    expect(compiled.index).toBe("realms");
    expect(
      compiled.filter.some((clause) =>
        clause.includes("__zone_boundary_empty_intersection__"),
      ),
    ).toBe(true);
  });

  test("compiles a zone query against the zones index", () => {
    const compiled = compileZoneSectionQuery(
      {
        target: "zone",
        types: ["ZONE"],
        realm: "context",
        languages: "viewer",
        sort: { field: "updatedAt", direction: "desc" },
      },
      { types: ["ZONE"] },
      {
        contextRealmUnitId: "realm-1",
        viewerLanguageCandidates: ["zh-hant"],
      },
    );

    expect(compiled.index).toBe("zones");
    expect(compiled.filter).toContain('ownerRealmUnitId = "realm-1"');
    expect(compiled.filter).toContain('visibility = "PUBLIC"');
    expect(compiled.filter).toContain(
      '(isLanguageNeutral = true OR languages IN ["zh-hant"])',
    );
    expect(compiled.sort).toEqual(["updatedAt:desc"]);
  });

  test("viewer languages respect all-language mode", () => {
    const compiled = compileZoneSectionQuery(
      {
        target: "zone",
        types: ["ZONE"],
        languages: "viewer",
        sort: { field: "updatedAt", direction: "desc" },
      },
      undefined,
      {
        viewerLanguageCandidates: ["zh-hant"],
        viewerLanguageMode: "all",
      },
    );

    expect(
      compiled.filter.some((clause) => clause.includes("languages IN")),
    ).toBe(false);
  });

  test("zone queries cannot widen an incompatible zone boundary", () => {
    const compiled = compileZoneSectionQuery(
      {
        target: "zone",
        types: ["ZONE"],
        sort: { field: "updatedAt" },
      },
      { types: ["REALM"] },
      {},
    );

    expect(compiled.index).toBe("zones");
    expect(
      compiled.filter.some((clause) =>
        clause.includes("__zone_boundary_empty_intersection__"),
      ),
    ).toBe(true);
  });

  test("context realm resolves to unscoped for global-context zones", () => {
    const compiled = compileZoneSectionQuery(
      {
        target: "unit",
        realm: "context",
        sort: { field: "createdAt" },
      },
      undefined,
      { contextRealmUnitId: null },
    );
    expect(
      compiled.filter.some((clause) => clause.startsWith("realmIds")),
    ).toBe(false);
  });

  test("the boundary narrows the query and never widens it", () => {
    const compiled = compileZoneSectionQuery(
      {
        target: "unit",
        types: ["BOOK", "SERIES"],
        ratings: ["GENERAL", "R_15"],
        tagUnitIds: ["tag-a"],
        sort: { field: "createdAt" },
      },
      {
        types: ["BOOK"],
        ratings: ["GENERAL"],
        tagUnitIds: ["tag-b"],
        realm: { unitIds: ["realm-9"] },
      },
      {},
    );
    expect(compiled.filter).toContain('type = "BOOK"');
    expect(compiled.filter).toContain('rating = "GENERAL"');
    // boundary tags compose by union (each tag is AND-ed)
    expect(compiled.filter).toContain('tagIds = "tag-a"');
    expect(compiled.filter).toContain('tagIds = "tag-b"');
    expect(compiled.filter).toContain('realmIds = "realm-9"');
  });

  test("an empty boundary intersection matches nothing", () => {
    const compiled = compileZoneSectionQuery(
      {
        target: "unit",
        types: ["BOOK"],
        sort: { field: "createdAt" },
      },
      { types: ["SERIES"] },
      {},
    );
    expect(
      compiled.filter.some((clause) =>
        clause.includes("__zone_boundary_empty_intersection__"),
      ),
    ).toBe(true);
  });

  test("rejects fields the target index cannot filter or sort", () => {
    expect(
      zoneSectionQueryUnsupportedFields({
        target: "post",
        tagUnitIds: ["tag-1"],
        subjects: { roles: ["character"] },
        ratings: ["GENERAL"],
        sort: { field: "publishedAt" },
      }),
    ).toEqual(["tagUnitIds", "subjects", "ratings", "sort.publishedAt"]);

    expect(
      zoneSectionQueryUnsupportedFields({
        target: "unit",
        subjects: { entityUnitIds: ["entity-1"], roles: ["character"] },
        sort: { field: "replyCount" },
      }),
    ).toEqual(["sort.replyCount"]);

    expect(
      zoneSectionQueryUnsupportedFields({
        target: "realm",
        realm: "context",
        sort: { field: "qualityScore" },
      }),
    ).toEqual(["realm", "sort.qualityScore"]);

    expect(
      zoneSectionQueryUnsupportedFields({
        target: "zone",
        tagUnitIds: ["tag-1"],
        sort: { field: "memberCount" },
      }),
    ).toEqual(["tagUnitIds", "sort.memberCount"]);

    expect(() =>
      compileZoneSectionQuery(
        {
          target: "post",
          tagUnitIds: ["tag-1"],
          sort: { field: "createdAt" },
        },
        undefined,
        {},
      ),
    ).toThrow("unsupported on the post index");
  });
});

describe("zone scope boundary in federated builders", () => {
  const zoneScope: SearchScope = { kind: "zone", zoneUnitId: "zone-1" };

  test("content sub-queries embed the pre-compiled zone boundary", () => {
    const filter = buildContentFilter(emptyQuery, zoneScope, {
      zoneBoundaryContentFilter: ['type = "BOOK"', 'realmIds = "realm-1"'],
    });
    expect(filter).toContain('type = "BOOK"');
    expect(filter).toContain('realmIds = "realm-1"');
  });

  test("post sub-queries embed the pre-compiled zone boundary", () => {
    const filter = buildPostFilter(emptyQuery, zoneScope, {
      zoneBoundaryPostFilter: ['kind = "WIKI"'],
    });
    expect(filter).toContain('kind = "WIKI"');
  });
});
