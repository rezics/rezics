import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import {
  zoneColumnsSectionSchema,
  zoneContentSectionSchema,
  zonePageSectionSchema,
  zoneSectionQuerySchema,
  zoneTabsSectionSchema,
} from "./section";

const latestWikiQuery = {
  target: "post",
  postKinds: ["WIKI"],
  realm: "context",
  sort: { field: "updatedAt", direction: "desc" },
} as const;

describe("zone section query", () => {
  test("accepts the filter vocabulary with context realm and viewer languages", () => {
    expect(
      Value.Check(zoneSectionQuerySchema, {
        target: "unit",
        types: ["BOOK", "SERIES"],
        realm: { unitIds: ["realm-1"] },
        tagUnitIds: ["tag-1"],
        subjects: { entityUnitIds: ["entity-1"], roles: ["character"] },
        languages: "viewer",
        ratings: ["GENERAL"],
        sort: { field: "publishedAt" },
      }),
    ).toBe(true);
    expect(Value.Check(zoneSectionQuerySchema, latestWikiQuery)).toBe(true);
  });

  test("requires a sort and rejects unknown fields", () => {
    expect(Value.Check(zoneSectionQuerySchema, { target: "post" })).toBe(false);
    expect(
      Value.Check(zoneSectionQuerySchema, {
        ...latestWikiQuery,
        keyword: "search text",
      }),
    ).toBe(false);
    expect(
      Value.Check(zoneSectionQuerySchema, {
        ...latestWikiQuery,
        sort: { field: "viewCount" },
      }),
    ).toBe(false);
  });
});

describe("zone section nesting rules", () => {
  const querySection = {
    id: "s-query",
    kind: "query",
    query: latestWikiQuery,
    display: "list",
  };

  const tabsSection = {
    id: "s-tabs",
    kind: "tabs",
    tabs: [{ id: "tab-1", sections: [querySection] }],
  };

  test("tabs panes hold content sections only", () => {
    expect(Value.Check(zoneTabsSectionSchema, tabsSection)).toBe(true);
    expect(
      Value.Check(zoneTabsSectionSchema, {
        ...tabsSection,
        tabs: [{ id: "tab-1", sections: [tabsSection] }],
      }),
    ).toBe(false);
  });

  test("columns hold content sections or tabs, never columns", () => {
    const columnsSection = {
      id: "s-columns",
      kind: "columns",
      sidePosition: "right",
      side: [querySection],
      main: [tabsSection],
    };
    expect(Value.Check(zoneColumnsSectionSchema, columnsSection)).toBe(true);
    expect(Value.Check(zonePageSectionSchema, columnsSection)).toBe(true);
    expect(
      Value.Check(zoneColumnsSectionSchema, {
        ...columnsSection,
        main: [columnsSection],
      }),
    ).toBe(false);
    // columns is not a content section, so it can never nest below page level
    expect(Value.Check(zoneContentSectionSchema, columnsSection)).toBe(false);
  });

  test("hero owns no text fields", () => {
    expect(
      Value.Check(zonePageSectionSchema, {
        id: "s-hero",
        kind: "hero",
        showDescription: true,
        bannerImageUrl: "https://cdn.example/banner.png",
        ctas: [
          { target: { kind: "zonePage", pageId: "feed" } },
          {
            target: { kind: "unit", unitId: "unit-1" },
            labelUnitId: "label-1",
          },
        ],
      }),
    ).toBe(true);
    expect(
      Value.Check(zonePageSectionSchema, {
        id: "s-hero",
        kind: "hero",
        title: "Toaru Wiki",
      }),
    ).toBe(false);
  });

  test("collection and stats validate strictly", () => {
    expect(
      Value.Check(zonePageSectionSchema, {
        id: "s-collection",
        kind: "collection",
        display: "covers",
        items: [{ target: { kind: "unit", unitId: "book-1" } }],
      }),
    ).toBe(true);
    expect(
      Value.Check(zonePageSectionSchema, {
        id: "s-stats",
        kind: "stats",
        metrics: ["articles", "members"],
      }),
    ).toBe(true);
    expect(
      Value.Check(zonePageSectionSchema, {
        id: "s-stats",
        kind: "stats",
        metrics: ["edits"],
      }),
    ).toBe(false);
  });
});
