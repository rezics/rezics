import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import {
  pageColumnsSectionSchema,
  pageContentSectionSchema,
  pageDynamicTagsSchema,
  pageSectionSchema,
  PAGE_SECTION_QUERY_FILTERABLE_FIELDS,
  PAGE_SECTION_QUERY_SORT_FIELDS,
  pageSectionQuerySchema,
  pageSourcesSectionSchema,
  pageTabsSectionSchema,
} from "./sections";

const nodeId = "01972fd2-0ed8-7b7b-97f5-a4fc0e4d6b8d";

const latestWikiQuery = {
  target: "post",
  postKinds: ["WIKI"],
  realm: "context",
  sort: { field: "updatedAt", direction: "desc" },
} as const;

describe("page section query", () => {
  test("accepts the filter vocabulary with context realm and viewer languages", () => {
    expect(
      Value.Check(pageSectionQuerySchema, {
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
    expect(Value.Check(pageSectionQuerySchema, latestWikiQuery)).toBe(true);
    expect(
      Value.Check(pageSectionQuerySchema, {
        target: "realm",
        types: ["REALM"],
        languages: ["en"],
        sort: { field: "memberCount", direction: "desc" },
      }),
    ).toBe(true);
    expect(
      Value.Check(pageSectionQuerySchema, {
        target: "zone",
        types: ["ZONE"],
        realm: "context",
        languages: "viewer",
        sort: { field: "updatedAt", direction: "desc" },
      }),
    ).toBe(true);
  });

  test("publishes per-target filter and sort vocabularies", () => {
    expect(PAGE_SECTION_QUERY_FILTERABLE_FIELDS.zone).toEqual([
      "types",
      "realm",
      "languages",
    ]);
    expect(PAGE_SECTION_QUERY_SORT_FIELDS.zone).toEqual([
      "createdAt",
      "updatedAt",
    ]);
  });

  test("requires a sort and rejects unknown fields", () => {
    expect(Value.Check(pageSectionQuerySchema, { target: "post" })).toBe(false);
    expect(
      Value.Check(pageSectionQuerySchema, {
        ...latestWikiQuery,
        keyword: "search text",
      }),
    ).toBe(false);
    expect(
      Value.Check(pageSectionQuerySchema, {
        ...latestWikiQuery,
        sort: { field: "viewCount" },
      }),
    ).toBe(false);
  });
});

describe("page dynamic tags", () => {
  test("accepts weighted canonical tag unit id options on query sections", () => {
    const dynamicTags = {
      groupId: "book-home-topics",
      fallback: true,
      options: [
        { tagUnitIds: ["tag-sci-fi"], probability: 0.4 },
        { tagUnitIds: ["tag-history", "tag-biography"], probability: 0.3 },
      ],
    };

    expect(Value.Check(pageDynamicTagsSchema, dynamicTags)).toBe(true);
    expect(
      Value.Check(pageContentSectionSchema, {
        nodeId,
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
      Value.Check(pageDynamicTagsSchema, {
        options: [{ id: "x", tagUnitIds: ["tag-1"], probability: 1 }],
      }),
    ).toBe(false);
    expect(
      Value.Check(pageDynamicTagsSchema, {
        options: [{ tagUnitIds: [], probability: 1 }],
      }),
    ).toBe(false);
    expect(
      Value.Check(pageDynamicTagsSchema, {
        options: [{ tagUnitIds: ["tag-1"], probability: 1.2 }],
      }),
    ).toBe(false);
    expect(
      Value.Check(pageContentSectionSchema, {
        nodeId,
        kind: "stream",
        dynamicTags: { options: [{ tagUnitIds: ["tag-1"], probability: 1 }] },
      }),
    ).toBe(false);
  });
});

describe("page section nesting rules", () => {
  const querySection = {
    nodeId,
    kind: "query",
    query: latestWikiQuery,
    display: "list",
  };

  test("query sections can opt into stream display", () => {
    expect(
      Value.Check(pageContentSectionSchema, {
        ...querySection,
        display: "stream",
      }),
    ).toBe(true);
  });

  const tabsSection = {
    nodeId,
    kind: "tabs",
    tabs: [{ nodeId, sections: [querySection] }],
  };

  test("tabs panes hold content sections only", () => {
    expect(Value.Check(pageTabsSectionSchema, tabsSection)).toBe(true);
    expect(
      Value.Check(pageTabsSectionSchema, {
        ...tabsSection,
        tabs: [{ nodeId, sections: [tabsSection] }],
      }),
    ).toBe(false);
  });

  test("columns hold content sections or tabs, never columns", () => {
    const columnsSection = {
      nodeId,
      kind: "columns",
      columns: [
        { ratio: 3, sections: [tabsSection] },
        { ratio: 1, sections: [querySection] },
      ],
    };
    expect(Value.Check(pageColumnsSectionSchema, columnsSection)).toBe(true);
    expect(Value.Check(pageSectionSchema, columnsSection)).toBe(true);
    expect(
      Value.Check(pageColumnsSectionSchema, {
        ...columnsSection,
        columns: [
          { ratio: 1, sections: [columnsSection] },
          { ratio: 1, sections: [] },
        ],
      }),
    ).toBe(false);
    // columns is not a content section, so it can never nest below page level
    expect(Value.Check(pageContentSectionSchema, columnsSection)).toBe(false);
  });

  test("columns validate count, ratio bounds, and reject legacy fields", () => {
    const column = { ratio: 1, sections: [querySection] };
    expect(
      Value.Check(pageColumnsSectionSchema, {
        nodeId,
        kind: "columns",
        columns: [
          { ratio: 7, sections: [querySection] },
          { ratio: 3, sections: [tabsSection] },
          { ratio: 2, sections: [] },
          { ratio: 1, sections: [] },
        ],
      }),
    ).toBe(true);
    expect(
      Value.Check(pageColumnsSectionSchema, {
        nodeId,
        kind: "columns",
        columns: [column],
      }),
    ).toBe(false);
    expect(
      Value.Check(pageColumnsSectionSchema, {
        nodeId,
        kind: "columns",
        columns: [column, column, column, column, column],
      }),
    ).toBe(false);
    expect(
      Value.Check(pageColumnsSectionSchema, {
        nodeId,
        kind: "columns",
        columns: [
          { ratio: 0, sections: [] },
          { ratio: 1, sections: [] },
        ],
      }),
    ).toBe(false);
    expect(
      Value.Check(pageColumnsSectionSchema, {
        nodeId,
        kind: "columns",
        columns: [
          { ratio: 13, sections: [] },
          { ratio: 1, sections: [] },
        ],
      }),
    ).toBe(false);
    expect(
      Value.Check(pageColumnsSectionSchema, {
        nodeId,
        kind: "columns",
        sidePosition: "right",
        side: [querySection],
        main: [tabsSection],
      }),
    ).toBe(false);
  });

  test("stage composes explicit profile, image, actions, and columns", () => {
    expect(
      Value.Check(pageSectionSchema, {
        nodeId,
        kind: "stage",
        background: {
          color: "var(--colors-surface-subtle)",
          imageUrl: "https://cdn.example/banner.png",
          fit: "cover",
          position: "center",
        },
        mask: { color: "black", opacity: 0.35 },
        sections: [
          { nodeId, kind: "zoneInfo", showDescription: true },
          {
            nodeId,
            kind: "image",
            url: "https://cdn.example/logo.png",
            variant: "logo",
            altLabelUnitId: "label-logo",
          },
          {
            nodeId,
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
            nodeId,
            kind: "columns",
            columns: [
              { ratio: 2, sections: [querySection] },
              { ratio: 1, sections: [] },
            ],
          },
        ],
      }),
    ).toBe(true);
    expect(
      Value.Check(pageSectionSchema, {
        nodeId,
        kind: "stage",
        background: { imageUrl: "http://cdn.example/banner.png" },
        sections: [],
      }),
    ).toBe(false);
    expect(
      Value.Check(pageSectionSchema, {
        nodeId,
        kind: "hero",
      }),
    ).toBe(false);
  });

  test("collection and stats validate strictly", () => {
    expect(
      Value.Check(pageSectionSchema, {
        nodeId,
        kind: "collection",
        display: "covers",
        items: [{ target: { kind: "unit", unitId: "book-1" } }],
      }),
    ).toBe(true);
    expect(
      Value.Check(pageSectionSchema, {
        nodeId,
        kind: "stats",
        metrics: ["articles", "members"],
      }),
    ).toBe(true);
    expect(
      Value.Check(pageSectionSchema, {
        nodeId,
        kind: "stats",
        metrics: ["edits"],
      }),
    ).toBe(false);
  });

  test("sources section owns no target unit field", () => {
    expect(
      Value.Check(pageSourcesSectionSchema, {
        nodeId,
        kind: "sources",
      }),
    ).toBe(true);
    expect(
      Value.Check(pageSectionSchema, {
        nodeId,
        kind: "sources",
        titleLabelUnitId: "label-1",
        emptyState: "show-empty",
      }),
    ).toBe(true);
    expect(
      Value.Check(pageSourcesSectionSchema, {
        nodeId,
        kind: "sources",
        unitId: "other-unit",
      }),
    ).toBe(false);
  });
});
