import { describe, expect, it } from "bun:test";
import type {
  ZoneBoundary,
  ZoneMenuNode,
  ZoneNav,
  ZonePage,
  ZoneTheme,
} from "@rezics/contract";
import {
  addZonePage,
  addZonePageDraftIfMissing,
  addZoneTranslationRow,
  applyZoneManageJsonBody,
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
  parseZoneManageJsonText,
  removeZoneMenuAtIndex,
  removeZoneMenuNodeAtPath,
  removeZonePage,
  removeZoneTranslationRow,
  updateZoneManageJsonProblems,
  updateZoneMenuAtIndex,
  updateZonePageSections,
  updateZoneTranslationRow,
  validateZoneManageDraft,
  ZONE_TRANSLATION_LANGUAGES,
  zoneDynamicTagsFallbackProbability,
  zoneManageDraftToBoundary,
  zoneManageDraftToNav,
  zoneManageDraftToPage,
  zoneManageDraftToTheme,
  zoneManageJsonBody,
  zoneManageJsonText,
  zoneMenuNodeAtPath,
  zoneQueryUnsupportedFields,
  zoneRowsToTranslations,
  zoneShellToDraft,
  zoneTranslationLanguageOptions,
  zoneTranslationsToRows,
} from "./zoneManageDraft";

function sampleBoundary(): ZoneBoundary {
  return {
    schema: "rezics/zone-boundary",
    version: 1,
    context: { kind: "realm", realmUnitId: "realm-1" },
    filters: { types: ["BOOK"] },
  };
}

function sampleNav(): ZoneNav {
  return {
    schema: "rezics/zone-nav",
    version: 1,
    menus: [
      {
        id: "main",
        nodes: [
          { id: "n-1", target: { kind: "zonePage", pageId: "page-home" } },
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
  };
}

function sampleTheme(): ZoneTheme {
  return {
    schema: "rezics/zone-theme",
    version: 1,
    tokens: { accent: "oklch(0.7 0.1 20)" },
    layout: { contentMaxWidth: 1440 },
  };
}

function samplePage(): ZonePage {
  return {
    schema: "rezics/zone-page",
    version: 1,
    sections: [
      { id: "hero", kind: "hero" },
      {
        id: "cols",
        kind: "columns",
        columns: [
          {
            id: "main",
            ratio: 3,
            sections: [
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
          {
            id: "side",
            ratio: 1,
            sections: [{ id: "stats", kind: "stats", metrics: ["members"] }],
          },
        ],
      },
    ],
  };
}

function sampleDraft() {
  return zoneShellToDraft({
    boundary: sampleBoundary(),
    nav: sampleNav(),
    theme: sampleTheme(),
    page: samplePage(),
  });
}

describe("zoneManageDraft split round-trip", () => {
  it("shell/page envelopes round-trip through the draft adapter", () => {
    const draft = sampleDraft();
    expect(zoneManageDraftToBoundary(draft)).toEqual(sampleBoundary());
    expect(zoneManageDraftToNav(draft)).toEqual(sampleNav());
    expect(zoneManageDraftToTheme(draft)).toEqual(sampleTheme());
    expect(zoneManageDraftToPage(draft, "home")).toEqual(samplePage());
  });

  it("draft edits do not leak into the source envelopes", () => {
    const nav = sampleNav();
    const draft = zoneShellToDraft({
      boundary: sampleBoundary(),
      nav,
      theme: sampleTheme(),
      page: samplePage(),
    });
    draft.menus[0]!.id = "changed";
    expect(nav.menus[0]!.id).toBe("main");
  });
});

describe("zone manage JSON body editor", () => {
  it("keeps repeated empty diagnostics as a state no-op", () => {
    const empty = {};
    expect(updateZoneManageJsonProblems(empty, "nav", [])).toBe(empty);

    const withProblem = updateZoneManageJsonProblems(empty, "nav", ["bad"]);
    expect(withProblem).toEqual({ nav: ["bad"] });
    expect(updateZoneManageJsonProblems(withProblem, "nav", ["bad"])).toBe(
      withProblem,
    );
    expect(updateZoneManageJsonProblems(withProblem, "nav", [])).toEqual({});
  });

  it("edits envelope bodies without dropping page fields", () => {
    const draft = sampleDraft();
    const body = zoneManageJsonBody(draft, { kind: "page", pageId: "home" });
    expect(body).toEqual({ sections: samplePage().sections });

    const nextText = zoneManageJsonText(draft, {
      kind: "page",
      pageId: "home",
    });
    const parsed = parseZoneManageJsonText(
      { kind: "page", pageId: "home" },
      nextText,
    );
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      const applied = applyZoneManageJsonBody(
        draft,
        {
          kind: "page",
          pageId: "home",
        },
        parsed.body,
      );
      expect(zoneManageDraftToPage(applied, "home")).toEqual(samplePage());
    }
  });

  it("signals invalid JSON instead of mutating the draft", () => {
    const parsed = parseZoneManageJsonText(
      { kind: "theme" },
      '{"tokens": {"accent":',
    );
    expect(parsed.ok).toBe(false);
  });

  it("validates JSON bodies with the contract schema before save", () => {
    const parsed = parseZoneManageJsonText(
      { kind: "theme" },
      JSON.stringify({ images: { logoUrl: "http://example.com/logo.png" } }),
    );
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(
        parsed.problems.some((problem) => problem.path.includes("logoUrl")),
      ).toBe(true);
    }
  });

  it("strips system-owned envelope metadata injected through JSON", () => {
    const draft = sampleDraft();
    const parsed = parseZoneManageJsonText(
      { kind: "theme" },
      JSON.stringify({
        schema: "rezics/zone-config",
        version: 99,
        tokens: { accent: "rgb(219 81 92)" },
      }),
    );
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      const applied = applyZoneManageJsonBody(
        draft,
        { kind: "theme" },
        parsed.body,
      );
      expect(zoneManageDraftToTheme(applied)).toEqual({
        schema: "rezics/zone-theme",
        version: 1,
        tokens: { accent: "rgb(219 81 92)" },
        images: undefined,
        layout: undefined,
      });
    }
  });

  it("preserves non-hex CSS color strings in theme saves", () => {
    const draft = sampleDraft();
    draft.theme.tokens = { accent: "oklch(0.7 0.1 20)" };
    expect(zoneManageDraftToTheme(draft).tokens?.accent).toBe(
      "oklch(0.7 0.1 20)",
    );
  });
});

describe("section nesting guards", () => {
  it("rejects containers inside tabs panes", () => {
    expect(canInsertZoneSectionKind("tabs", "tabs")).toBe(false);
    expect(canInsertZoneSectionKind("tabs", "columns")).toBe(false);
    expect(canInsertZoneSectionKind("tabs", "query")).toBe(true);
    expect(canInsertZoneSectionKind("tabs", "sources")).toBe(true);
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
  it("collects nested ids across the managed page and containers", () => {
    expect(collectZoneSectionIds(sampleDraft().pages)).toEqual([
      "hero",
      "cols",
      "tabs",
      "q-1",
      "stats",
    ]);
  });

  it("creates a valid two-column section by default", () => {
    expect(createZoneSection("columns", "cols")).toEqual({
      id: "cols",
      kind: "columns",
      columns: [
        { id: "main", ratio: 3, sections: [] },
        { id: "side", ratio: 1, sections: [] },
      ],
    });
  });

  it("creates a minimal sources section by default", () => {
    expect(createZoneSection("sources", "sources-1")).toEqual({
      id: "sources-1",
      kind: "sources",
    });
  });

  it("flags duplicate section ids including nested ones", () => {
    const draft = sampleDraft();
    draft.pages = updateZonePageSections(draft.pages, "home", () => [
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

describe("tabs invariants", () => {
  it("flags duplicate tab ids and missing default tab", () => {
    const draft = sampleDraft();
    draft.pages = updateZonePageSections(draft.pages, "home", () => [
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

  it("allows only realm index filters and sorts on realm target", () => {
    expect(
      zoneQueryUnsupportedFields({
        target: "realm",
        types: ["REALM"],
        languages: ["en"],
        sort: { field: "memberCount" },
      }),
    ).toEqual([]);
    expect(
      zoneQueryUnsupportedFields({
        target: "realm",
        realm: "context",
        sort: { field: "qualityScore" },
      }),
    ).toEqual(["realm", "sort.qualityScore"]);
  });

  it("allows zone index filters and sorts on zone target", () => {
    expect(
      zoneQueryUnsupportedFields({
        target: "zone",
        types: ["ZONE"],
        realm: "context",
        languages: "viewer",
        sort: { field: "updatedAt", direction: "desc" },
      }),
    ).toEqual([]);
    expect(
      zoneQueryUnsupportedFields({
        target: "zone",
        tagUnitIds: ["tag-1"],
        sort: { field: "memberCount" },
      }),
    ).toEqual(["tagUnitIds", "sort.memberCount"]);
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

  it("coerces zone target switches by dropping unsupported fields", () => {
    const coerced = coerceZoneQueryTarget(
      {
        target: "unit",
        types: ["ZONE"],
        tagUnitIds: ["tag-1"],
        realm: "context",
        languages: "viewer",
        sort: { field: "qualityScore", direction: "desc" },
      },
      "zone",
    );
    expect(coerced).toEqual({
      target: "zone",
      types: ["ZONE"],
      realm: "context",
      languages: "viewer",
      sort: { field: "createdAt", direction: "desc" },
    });
    expect(zoneQueryUnsupportedFields(coerced)).toEqual([]);
  });

  it("validates dynamic tag probability totals with and without fallback", () => {
    const draft = sampleDraft();
    draft.pages = updateZonePageSections(draft.pages, "home", () => [
      {
        id: "dynamic",
        kind: "query",
        query: {
          target: "unit",
          types: ["BOOK"],
          sort: { field: "hotScore", direction: "desc" },
        },
        display: "carousel",
        dynamicTags: {
          options: [
            { tagUnitIds: ["tag-a"], probability: 0.4 },
            { tagUnitIds: ["tag-b"], probability: 0.6 },
          ],
        },
      },
    ]);
    expect(validateZoneManageDraft(draft)).toEqual([]);

    const section = draft.pages.home.sections[0];
    if (section?.kind === "query") {
      section.dynamicTags = {
        fallback: true,
        options: [{ tagUnitIds: ["tag-a"], probability: 0.4 }],
      };
      expect(zoneDynamicTagsFallbackProbability(section.dynamicTags)).toBe(0.6);
    }
    expect(validateZoneManageDraft(draft)).toEqual([]);
  });

  it("rejects overfull dynamic tags and dynamic tags on non-unit query targets", () => {
    const draft = sampleDraft();
    draft.pages = updateZonePageSections(draft.pages, "home", () => [
      {
        id: "dynamic-overfull",
        kind: "query",
        query: {
          target: "unit",
          sort: { field: "hotScore", direction: "desc" },
        },
        display: "carousel",
        dynamicTags: {
          fallback: true,
          options: [
            { tagUnitIds: ["tag-a"], probability: 0.8 },
            { tagUnitIds: ["tag-b"], probability: 0.3 },
          ],
        },
      },
      {
        id: "dynamic-post",
        kind: "query",
        query: {
          target: "post",
          sort: { field: "hotScore", direction: "desc" },
        },
        display: "list",
        dynamicTags: {
          options: [{ tagUnitIds: ["tag-a"], probability: 1 }],
        },
      },
    ]);

    const issues = validateZoneManageDraft(draft);
    expect(issues).toContainEqual({
      code: "dynamic_tags_probability_invalid",
      sectionId: "dynamic-overfull",
      total: 1.1,
    });
    expect(issues).toContainEqual({
      code: "dynamic_tags_target_unsupported",
      sectionId: "dynamic-post",
    });
  });
});

describe("menu tree path operations", () => {
  const nodes = (): ZoneMenuNode[] => [
    { id: "a", target: { kind: "zonePage", pageId: "page-home" } },
    {
      id: "b",
      labelUnitId: "label-1",
      children: [
        { id: "b-1", target: { kind: "zonePage", pageId: "page-search" } },
        { id: "b-2", target: { kind: "zonePage", pageId: "page-feed" } },
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
    const unmoved = moveZoneMenuNodeAtPath(nodes(), [0], "up");
    expect(zoneMenuNodeAtPath(unmoved, [0])?.id).toBe("a");
  });

  it("indents into the previous sibling with a depth guard", () => {
    const indented = indentZoneMenuNodeAtPath(nodes(), [1, 1]);
    expect(indented).not.toBeNull();
    expect(zoneMenuNodeAtPath(indented!, [1, 0, 0])?.id).toBe("b-2");
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
  it("keeps header.menuId aligned when the referenced menu id changes", () => {
    const draft = sampleDraft();
    const renamed = updateZoneMenuAtIndex(draft, 0, {
      ...draft.menus[0]!,
      id: "renamed",
    });
    expect(renamed.header.menuId).toBe("renamed");
    expect(renamed.menus[0]?.id).toBe("renamed");
  });

  it("falls header.menuId back when the referenced menu is removed", () => {
    const draft = sampleDraft();
    draft.menus = [
      { id: "main", nodes: [] },
      { id: "secondary", nodes: [] },
    ];
    draft.header = { menuId: "main" };
    const removed = removeZoneMenuAtIndex(draft, 0);
    expect(removed.header.menuId).toBe("secondary");
    expect(removed.menus).toEqual([{ id: "secondary", nodes: [] }]);
  });

  it("flags depth, leaf, group, and header issues", () => {
    const draft = sampleDraft();
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

  it("returns no issues for the sample draft", () => {
    expect(validateZoneManageDraft(sampleDraft())).toEqual([]);
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
      ZONE_TRANSLATION_LANGUAGES.map((language) => ({
        language: language as never,
      })),
    );
    expect(addZoneTranslationRow(full)).toHaveLength(full.length);
  });

  it("edits and removes rows by index", () => {
    const rows = zoneTranslationsToRows([{ language: "en", title: "A" }]);
    const edited = updateZoneTranslationRow(rows, 0, { title: "B" });
    expect(edited[0]?.title).toBe("B");
    expect(removeZoneTranslationRow(edited, 0)).toEqual([]);
  });
});

describe("page helpers", () => {
  it("adds fetched page drafts without overwriting local page edits", () => {
    const draft = sampleDraft();
    draft.pages.home = { sections: [{ id: "local", kind: "hero" }] };
    const samePage = addZonePageDraftIfMissing(draft, "home", samplePage());
    expect(samePage).toBe(draft);
    expect(samePage.pages.home.sections).toEqual([
      { id: "local", kind: "hero" },
    ]);

    const nextPage = addZonePageDraftIfMissing(
      draft,
      "page-extra",
      samplePage(),
    );
    expect(nextPage.pages["page-extra"]).toEqual({
      sections: samplePage().sections,
    });
  });

  it("adds and removes open page draft entries", () => {
    const draft = sampleDraft();
    const withCharacters = addZonePage(draft.pages, "page-characters");
    expect(withCharacters["page-characters"]).toEqual({ sections: [] });
    expect(removeZonePage(withCharacters, "home").home).toBeUndefined();
    expect(
      removeZonePage(withCharacters, "page-characters")["page-characters"],
    ).toBeUndefined();
  });

  it("moveListItem reorders within bounds", () => {
    expect(moveListItem([1, 2, 3], 0, "down")).toEqual([2, 1, 3]);
    expect(moveListItem([1, 2, 3], 0, "up")).toEqual([1, 2, 3]);
  });
});
