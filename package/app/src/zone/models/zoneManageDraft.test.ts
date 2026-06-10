import { describe, expect, it } from "bun:test";
import type { ZoneConfig, ZoneMenuNode } from "@rezics/contract";
import {
  addZonePage,
  addZoneTranslationRow,
  canAddZoneMenuChild,
  canInsertZoneSectionKind,
  coerceZoneQueryTarget,
  collectZoneSectionIds,
  createZoneSection,
  indentZoneMenuNodeAtPath,
  insertZoneMenuNode,
  moveListItem,
  moveZoneMenuNodeAtPath,
  nextZoneId,
  outdentZoneMenuNodeAtPath,
  removeZoneMenuNodeAtPath,
  removeZonePage,
  removeZoneTranslationRow,
  updateZoneTranslationRow,
  validateZoneManageDraft,
  zoneConfigToDraft,
  zoneManageDraftToConfig,
  zoneMenuNodeAtPath,
  zoneQueryUnsupportedFields,
  zoneRowsToTranslations,
  zoneTranslationLanguageOptions,
  zoneTranslationsToRows,
} from "./zoneManageDraft";

function sampleConfig(): ZoneConfig {
  return {
    schema: "rezics/zone-config",
    version: 1,
    context: { kind: "realm", realmUnitId: "realm-1" },
    filters: { types: ["BOOK"] },
    menus: [
      {
        id: "main",
        nodes: [
          {
            id: "n-1",
            target: { kind: "zonePage", pageId: "home" },
          },
          {
            id: "n-2",
            labelUnitId: "label-1",
            children: [
              {
                id: "n-2-1",
                target: { kind: "unit", unitId: "unit-1" },
              },
            ],
          },
        ],
      },
    ],
    header: { menuId: "main" },
    pages: {
      home: {
        sections: [
          { id: "hero", kind: "hero" },
          {
            id: "cols",
            kind: "columns",
            side: [{ id: "stats", kind: "stats", metrics: ["members"] }],
            main: [
              {
                id: "tabs",
                kind: "tabs",
                defaultTabId: "t-1",
                tabs: [
                  {
                    id: "t-1",
                    sections: [
                      {
                        id: "q-1",
                        kind: "query",
                        query: {
                          target: "unit",
                          types: ["BOOK"],
                          sort: { field: "publishedAt", direction: "desc" },
                        },
                        display: "grid",
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      search: { sections: [] },
    },
    theme: {
      tokens: { accent: "oklch(0.7 0.1 20)" },
      layout: { contentWidth: "wide" },
    },
  };
}

describe("zoneManageDraft round-trip", () => {
  it("envelope → draft → envelope is identity", () => {
    const config = sampleConfig();
    const draft = zoneConfigToDraft(config);
    expect(zoneManageDraftToConfig(draft)).toEqual(config);
  });

  it("draft edits do not leak into the source config", () => {
    const config = sampleConfig();
    const draft = zoneConfigToDraft(config);
    draft.menus[0]!.id = "changed";
    expect(config.menus[0]!.id).toBe("main");
  });
});

describe("section nesting guards", () => {
  it("rejects containers inside tabs panes", () => {
    expect(canInsertZoneSectionKind("tabs", "tabs")).toBe(false);
    expect(canInsertZoneSectionKind("tabs", "columns")).toBe(false);
    expect(canInsertZoneSectionKind("tabs", "query")).toBe(true);
  });

  it("rejects columns inside columns but allows tabs", () => {
    expect(canInsertZoneSectionKind("columns", "columns")).toBe(false);
    expect(canInsertZoneSectionKind("columns", "tabs")).toBe(true);
    expect(canInsertZoneSectionKind("columns", "hero")).toBe(true);
  });

  it("allows every kind at page level", () => {
    expect(canInsertZoneSectionKind("page", "columns")).toBe(true);
    expect(canInsertZoneSectionKind("page", "tabs")).toBe(true);
  });
});

describe("section ids", () => {
  it("collects nested ids across pages and containers", () => {
    const draft = zoneConfigToDraft(sampleConfig());
    expect(collectZoneSectionIds(draft.pages)).toEqual([
      "hero",
      "cols",
      "stats",
      "tabs",
      "q-1",
    ]);
  });

  it("flags duplicate section ids including nested ones", () => {
    const draft = zoneConfigToDraft(sampleConfig());
    draft.pages = updatePages(draft.pages, [
      ...draft.pages.home.sections,
      createZoneSection("feed", "stats"),
    ]);
    expect(validateZoneManageDraft(draft)).toContainEqual({
      code: "section_id_duplicate",
      id: "stats",
    });
  });

  it("nextZoneId skips taken ids", () => {
    expect(nextZoneId("section", ["section-1", "section-3"])).toBe("section-2");
  });
});

function updatePages(
  pages: ReturnType<typeof zoneConfigToDraft>["pages"],
  sections: ReturnType<typeof zoneConfigToDraft>["pages"]["home"]["sections"],
) {
  return { ...pages, home: { sections } };
}

describe("tabs invariants", () => {
  it("flags duplicate tab ids and missing default tab", () => {
    const draft = zoneConfigToDraft(sampleConfig());
    draft.pages = updatePages(draft.pages, [
      {
        id: "t",
        kind: "tabs",
        defaultTabId: "missing",
        tabs: [
          { id: "a", sections: [] },
          { id: "a", sections: [] },
        ],
      },
    ]);
    const issues = validateZoneManageDraft(draft);
    expect(issues).toContainEqual({ code: "tab_id_duplicate", sectionId: "t" });
    expect(issues).toContainEqual({
      code: "tab_default_invalid",
      sectionId: "t",
    });
  });
});

describe("query vocabulary", () => {
  it("rejects unit-only filters and replyCount sort on unit target", () => {
    expect(
      zoneQueryUnsupportedFields({
        target: "unit",
        types: ["BOOK"],
        sort: { field: "replyCount" },
      }),
    ).toEqual(["sort.replyCount"]);
  });

  it("rejects tag filters and publishedAt sort on post target", () => {
    expect(
      zoneQueryUnsupportedFields({
        target: "post",
        tagUnitIds: ["tag-1"],
        subjects: { roles: ["author"] },
        sort: { field: "publishedAt" },
      }),
    ).toEqual(["tagUnitIds", "subjects", "sort.publishedAt"]);
  });

  it("coerces target switches by dropping unsupported fields", () => {
    const coerced = coerceZoneQueryTarget(
      {
        target: "unit",
        types: ["BOOK"],
        postKinds: ["WIKI"],
        sort: { field: "publishedAt", direction: "asc" },
      },
      "post",
    );
    expect(coerced).toEqual({
      target: "post",
      postKinds: ["WIKI"],
      sort: { field: "createdAt", direction: "asc" },
    });
    expect(zoneQueryUnsupportedFields(coerced)).toEqual([]);
  });
});

describe("menu tree path operations", () => {
  const nodes = (): ZoneMenuNode[] => [
    { id: "a", target: { kind: "zonePage", pageId: "home" } },
    {
      id: "b",
      labelUnitId: "label-1",
      children: [
        { id: "b-1", target: { kind: "zonePage", pageId: "search" } },
        { id: "b-2", target: { kind: "zonePage", pageId: "feed" } },
      ],
    },
  ];

  it("reads nodes at paths", () => {
    expect(zoneMenuNodeAtPath(nodes(), [1, 0])?.id).toBe("b-1");
    expect(zoneMenuNodeAtPath(nodes(), [2])).toBeNull();
  });

  it("inserts at root and under parents", () => {
    const inserted = insertZoneMenuNode(nodes(), [1], {
      id: "b-3",
      target: { kind: "external", url: "https://example.com", text: "QQ" },
    });
    expect(inserted).not.toBeNull();
    expect(zoneMenuNodeAtPath(inserted!, [1, 2])?.id).toBe("b-3");
  });

  it("guards inserts beyond depth 3", () => {
    expect(canAddZoneMenuChild([0, 0])).toBe(true);
    expect(canAddZoneMenuChild([0, 0, 0])).toBe(false);
    const deep = insertZoneMenuNode(
      [
        {
          id: "a",
          children: [{ id: "a-1", children: [{ id: "a-1-1" }] }],
        },
      ],
      [0, 0, 0],
      { id: "too-deep" },
    );
    expect(deep).toBeNull();
  });

  it("removes and reorders by path", () => {
    const removed = removeZoneMenuNodeAtPath(nodes(), [1, 0]);
    expect(zoneMenuNodeAtPath(removed, [1, 0])?.id).toBe("b-2");
    const moved = moveZoneMenuNodeAtPath(nodes(), [1, 1], "up");
    expect(zoneMenuNodeAtPath(moved, [1, 0])?.id).toBe("b-2");
    // Edge moves are no-ops. 边界移动为空操作。
    const unmoved = moveZoneMenuNodeAtPath(nodes(), [0], "up");
    expect(zoneMenuNodeAtPath(unmoved, [0])?.id).toBe("a");
  });

  it("indents into the previous sibling with a depth guard", () => {
    const indented = indentZoneMenuNodeAtPath(nodes(), [1, 1]);
    expect(indented).not.toBeNull();
    expect(zoneMenuNodeAtPath(indented!, [1, 0, 0])?.id).toBe("b-2");
    // Indenting a tall subtree past depth 3 is rejected.
    // 将过高的子树缩进超过深度 3 会被拒绝。
    const tall: ZoneMenuNode[] = [
      { id: "x" },
      { id: "y", children: [{ id: "y-1", children: [{ id: "y-1-1" }] }] },
    ];
    expect(indentZoneMenuNodeAtPath(tall, [1])).toBeNull();
  });

  it("outdents to the parent level", () => {
    const outdented = outdentZoneMenuNodeAtPath(nodes(), [1, 0]);
    expect(outdented).not.toBeNull();
    expect(zoneMenuNodeAtPath(outdented!, [2])?.id).toBe("b-1");
    expect(outdentZoneMenuNodeAtPath(nodes(), [0])).toBeNull();
  });
});

describe("menu validation", () => {
  it("flags depth, leaf, group, and header issues", () => {
    const draft = zoneConfigToDraft(sampleConfig());
    draft.menus = [
      {
        id: "main",
        nodes: [
          {
            id: "n-1",
            children: [
              {
                id: "n-2",
                labelUnitId: "label-1",
                children: [
                  {
                    id: "n-3",
                    children: [{ id: "n-4" }],
                  },
                ],
              },
            ],
          },
        ],
      },
      { id: "main", nodes: [] },
    ];
    draft.header = { menuId: "missing" };
    const issues = validateZoneManageDraft(draft);
    expect(issues).toContainEqual({ code: "menu_too_deep", menuId: "main" });
    expect(issues).toContainEqual({ code: "menu_id_duplicate", id: "main" });
    expect(issues).toContainEqual({
      code: "menu_group_missing_label",
      menuId: "main",
      nodeId: "n-1",
    });
    expect(issues).toContainEqual({
      code: "menu_leaf_missing_target",
      menuId: "main",
      nodeId: "n-4",
    });
    expect(issues).toContainEqual({
      code: "header_menu_invalid",
      menuId: "missing",
    });
  });

  it("returns no issues for the sample config", () => {
    expect(validateZoneManageDraft(zoneConfigToDraft(sampleConfig()))).toEqual(
      [],
    );
  });
});

describe("translation rows", () => {
  it("maps translations to rows and back, dropping empty fields", () => {
    const rows = zoneTranslationsToRows([
      { language: "en", title: "Zone" },
      { language: "zh-hant", description: "說明" },
    ]);
    expect(rows).toEqual([
      { language: "en", title: "Zone", description: "" },
      { language: "zh-hant", title: "", description: "說明" },
    ]);
    expect(zoneRowsToTranslations(rows)).toEqual([
      { language: "en", title: "Zone" },
      { language: "zh-hant", description: "說明" },
    ]);
  });

  it("adds the first unused language and stops when exhausted", () => {
    let rows = zoneTranslationsToRows([{ language: "zh-hant" }]);
    rows = addZoneTranslationRow(rows);
    expect(rows[1]?.language).toBe("zh-hans");
    const options = zoneTranslationLanguageOptions(rows, "zh-hant");
    expect(options).toContain("zh-hant");
    expect(options).not.toContain("zh-hans");
    const full = zoneTranslationsToRows(
      ["zh-hant", "zh-hans", "en", "ja", "de", "ko"].map((language) => ({
        language: language as never,
      })),
    );
    expect(addZoneTranslationRow(full)).toHaveLength(6);
  });

  it("edits and removes rows by index", () => {
    const rows = zoneTranslationsToRows([{ language: "en", title: "A" }]);
    const edited = updateZoneTranslationRow(rows, 0, { title: "B" });
    expect(edited[0]?.title).toBe("B");
    expect(removeZoneTranslationRow(edited, 0)).toEqual([]);
  });
});

describe("page helpers", () => {
  it("adds optional pages, never removes home", () => {
    const draft = zoneConfigToDraft(sampleConfig());
    const withFeed = addZonePage(draft.pages, "feed");
    expect(withFeed.feed).toEqual({ sections: [] });
    expect(removeZonePage(withFeed, "home").home).toBeDefined();
    expect(removeZonePage(withFeed, "feed").feed).toBeUndefined();
  });

  it("moveListItem reorders within bounds", () => {
    expect(moveListItem([1, 2, 3], 0, "down")).toEqual([2, 1, 3]);
    expect(moveListItem([1, 2, 3], 0, "up")).toEqual([1, 2, 3]);
  });
});
