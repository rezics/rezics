import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import {
  zoneColumnsSectionSchema,
  zoneContentSectionSchema,
  zoneDynamicTagsSchema,
  zonePageSectionSchema,
  ZONE_SECTION_QUERY_FILTERABLE_FIELDS,
  ZONE_SECTION_QUERY_SORT_FIELDS,
  zoneSectionQuerySchema,
  zoneSourcesSectionSchema,
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
    expect(
      Value.Check(zoneSectionQuerySchema, {
        target: "realm",
        types: ["REALM"],
        languages: ["en"],
        sort: { field: "memberCount", direction: "desc" },
      }),
    ).toBe(true);
    expect(
      Value.Check(zoneSectionQuerySchema, {
        target: "zone",
        types: ["ZONE"],
        realm: "context",
        languages: "viewer",
        sort: { field: "updatedAt", direction: "desc" },
      }),
    ).toBe(true);
  });

  test("publishes per-target filter and sort vocabularies", () => {
    expect(ZONE_SECTION_QUERY_FILTERABLE_FIELDS.zone).toEqual([
      "types",
      "realm",
      "languages",
    ]);
    expect(ZONE_SECTION_QUERY_SORT_FIELDS.zone).toEqual([
      "createdAt",
      "updatedAt",
    ]);
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

describe("zone dynamic tags", () => {
  test("accepts weighted canonical tag unit id options on query sections", () => {
    const dynamicTags = {
      groupId: "book-home-topics",
      fallback: true,
      options: [
        { tagUnitIds: ["tag-sci-fi"], probability: 0.4 },
        { tagUnitIds: ["tag-history", "tag-biography"], probability: 0.3 },
      ],
    };

    expect(Value.Check(zoneDynamicTagsSchema, dynamicTags)).toBe(true);
    expect(
      Value.Check(zoneContentSectionSchema, {
        id: "s-dynamic",
        kind: "query",
        query: {
          target: "unit",
          types: ["BOOK"],
          sort: { field: "hotScore", direction: "desc" },
        },
        display: "carousel",
        dynamicTags,
      }),
    ).toBe(true);
  });

  test("rejects option ids, empty tag rows, and non-query placement", () => {
    expect(
      Value.Check(zoneDynamicTagsSchema, {
        options: [{ id: "x", tagUnitIds: ["tag-1"], probability: 1 }],
      }),
    ).toBe(false);
    expect(
      Value.Check(zoneDynamicTagsSchema, {
        options: [{ tagUnitIds: [], probability: 1 }],
      }),
    ).toBe(false);
    expect(
      Value.Check(zoneDynamicTagsSchema, {
        options: [{ tagUnitIds: ["tag-1"], probability: 1.2 }],
      }),
    ).toBe(false);
    expect(
      Value.Check(zoneContentSectionSchema, {
        id: "s-feed",
        kind: "stream",
        dynamicTags: { options: [{ tagUnitIds: ["tag-1"], probability: 1 }] },
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

  test("query sections can opt into stream display", () => {
    expect(
      Value.Check(zoneContentSectionSchema, {
        ...querySection,
        display: "stream",
      }),
    ).toBe(true);
  });

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
      columns: [
        { id: "main", ratio: 3, sections: [tabsSection] },
        { id: "side", ratio: 1, sections: [querySection] },
      ],
    };
    expect(Value.Check(zoneColumnsSectionSchema, columnsSection)).toBe(true);
    expect(Value.Check(zonePageSectionSchema, columnsSection)).toBe(true);
    expect(
      Value.Check(zoneColumnsSectionSchema, {
        ...columnsSection,
        columns: [
          { id: "nested", ratio: 1, sections: [columnsSection] },
          { id: "ok", ratio: 1, sections: [] },
        ],
      }),
    ).toBe(false);
    // columns is not a content section, so it can never nest below page level
    expect(Value.Check(zoneContentSectionSchema, columnsSection)).toBe(false);
  });

  test("columns validate count, ratio bounds, and reject legacy fields", () => {
    const column = { id: "a", ratio: 1, sections: [querySection] };
    expect(
      Value.Check(zoneColumnsSectionSchema, {
        id: "s-columns",
        kind: "columns",
        columns: [
          { id: "a", ratio: 7, sections: [querySection] },
          { id: "b", ratio: 3, sections: [tabsSection] },
          { id: "c", ratio: 2, sections: [] },
          { id: "d", ratio: 1, sections: [] },
        ],
      }),
    ).toBe(true);
    expect(
      Value.Check(zoneColumnsSectionSchema, {
        id: "s-columns",
        kind: "columns",
        columns: [column],
      }),
    ).toBe(false);
    expect(
      Value.Check(zoneColumnsSectionSchema, {
        id: "s-columns",
        kind: "columns",
        columns: [column, column, column, column, column],
      }),
    ).toBe(false);
    expect(
      Value.Check(zoneColumnsSectionSchema, {
        id: "s-columns",
        kind: "columns",
        columns: [
          { id: "a", ratio: 0, sections: [] },
          { id: "b", ratio: 1, sections: [] },
        ],
      }),
    ).toBe(false);
    expect(
      Value.Check(zoneColumnsSectionSchema, {
        id: "s-columns",
        kind: "columns",
        columns: [
          { id: "a", ratio: 13, sections: [] },
          { id: "b", ratio: 1, sections: [] },
        ],
      }),
    ).toBe(false);
    expect(
      Value.Check(zoneColumnsSectionSchema, {
        id: "s-columns",
        kind: "columns",
        sidePosition: "right",
        side: [querySection],
        main: [tabsSection],
      }),
    ).toBe(false);
  });

  test("stage composes explicit profile, image, actions, and columns", () => {
    expect(
      Value.Check(zonePageSectionSchema, {
        id: "s-stage",
        kind: "stage",
        background: {
          color: "var(--colors-surface-subtle)",
          imageUrl: "https://cdn.example/banner.png",
          fit: "cover",
          position: "center",
        },
        mask: { color: "black", opacity: 0.35 },
        sections: [
          { id: "zone-info", kind: "zoneInfo", showDescription: true },
          {
            id: "logo",
            kind: "image",
            url: "https://cdn.example/logo.png",
            variant: "logo",
            altLabelUnitId: "label-logo",
          },
          {
            id: "actions",
            kind: "actions",
            builtIns: ["joinRealm", "createWiki"],
            items: [
              { target: { kind: "zonePage", pageId: "feed" } },
              {
                target: { kind: "unit", unitId: "unit-1" },
                labelUnitId: "label-1",
              },
            ],
          },
          {
            id: "stage-columns",
            kind: "columns",
            columns: [
              { id: "main", ratio: 2, sections: [querySection] },
              { id: "side", ratio: 1, sections: [] },
            ],
          },
        ],
      }),
    ).toBe(true);
    expect(
      Value.Check(zonePageSectionSchema, {
        id: "s-stage",
        kind: "stage",
        background: { imageUrl: "http://cdn.example/banner.png" },
        sections: [],
      }),
    ).toBe(false);
    expect(
      Value.Check(zonePageSectionSchema, {
        id: "s-hero",
        kind: "hero",
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

  test("sources section owns no target unit field", () => {
    expect(
      Value.Check(zoneSourcesSectionSchema, {
        id: "s-sources",
        kind: "sources",
      }),
    ).toBe(true);
    expect(
      Value.Check(zonePageSectionSchema, {
        id: "s-sources",
        kind: "sources",
        titleLabelUnitId: "label-1",
        emptyState: "show-empty",
      }),
    ).toBe(true);
    expect(
      Value.Check(zoneSourcesSectionSchema, {
        id: "s-sources",
        kind: "sources",
        unitId: "other-unit",
      }),
    ).toBe(false);
  });
});
