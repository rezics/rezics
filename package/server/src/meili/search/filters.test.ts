import { describe, expect, test } from "bun:test";
import type { SearchQuery, SearchScope } from "@rezics/contract";
import {
  buildContentFilter,
  buildPostFilter,
  buildRealmFilter,
  buildUserFilter,
} from "./filters";

const emptyQuery: SearchQuery = {};

describe("buildContentFilter", () => {
  test("global scope with bare query yields visibility default", () => {
    const filter = buildContentFilter(emptyQuery, { kind: "global" });
    expect(filter).toEqual(['visibility = "PUBLIC"']);
  });

  test("book scope with shelves subtype emits SHELF type + containedUnitIds", () => {
    const scope: SearchScope = { kind: "book", unitId: "b-1" };
    const filter = buildContentFilter(emptyQuery, scope, {}, {
      contentSubtype: "shelves",
    });
    expect(filter).toContain('type = "SHELF"');
    expect(filter).toContain('containedUnitIds = "b-1"');
  });

  test("realm scope emits realmIds filter", () => {
    const scope: SearchScope = { kind: "realm", realmId: "r-7" };
    const filter = buildContentFilter(emptyQuery, scope);
    expect(filter).toContain('realmIds = "r-7"');
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

  test("languages list emits per-language clauses", () => {
    const filter = buildContentFilter(
      { languages: ["en", "ja"] },
      { kind: "global" },
    );
    expect(filter).toContain('languages = "en"');
    expect(filter).toContain('languages = "ja"');
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

  test("book scope emits rootTargetUnitId", () => {
    const filter = buildPostFilter(
      emptyQuery,
      { kind: "book", unitId: "b-2" },
    );
    expect(filter).toContain('rootTargetUnitId = "b-2"');
  });

  test("realm scope emits realmIds", () => {
    const filter = buildPostFilter(
      emptyQuery,
      { kind: "realm", realmId: "r-9" },
    );
    expect(filter).toContain('realmIds = "r-9"');
  });

  test("user scope emits authorUserId", () => {
    const filter = buildPostFilter(emptyQuery, { kind: "user", userId: "u-5" });
    expect(filter).toContain('authorUserId = "u-5"');
  });

  test("isLocked=false default is always present", () => {
    const filter = buildPostFilter(emptyQuery, { kind: "global" });
    expect(filter).toContain("isLocked = false");
  });

  test("query.postKind list emits IN clause when no postCategory hint", () => {
    const filter = buildPostFilter(
      { postKind: ["REVIEW", "REMARK"] },
      { kind: "global" },
    );
    expect(filter).toContain('kind IN ["REVIEW", "REMARK"]');
  });
});

describe("buildRealmFilter", () => {
  test("emits isPublic=true regardless of scope", () => {
    expect(buildRealmFilter(emptyQuery, { kind: "global" })).toEqual([
      "isPublic = true",
    ]);
  });
});

describe("buildUserFilter", () => {
  test("emits no filter for global scope", () => {
    expect(buildUserFilter(emptyQuery, { kind: "global" })).toEqual([]);
  });
});
