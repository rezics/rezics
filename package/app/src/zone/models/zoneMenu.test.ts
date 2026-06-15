import { describe, expect, it } from "bun:test";
import type { ZoneMenuNode, ZoneRefUnitSummary } from "@rezics/contract";
import {
  pickZoneMenu,
  resolveZoneMenuNodes,
  zoneCreateHref,
  zoneDetailKindForRef,
  zoneJoinHref,
  zoneLinkFallbackKey,
  zoneLinkHref,
  zoneLinkLabel,
  zonePageHref,
  zoneSectionItemHref,
  zoneSectionTitleKey,
  zoneSectionTitleText,
} from "./zoneMenu";

const refUnits: Record<string, ZoneRefUnitSummary> = {
  "label-1": { unitId: "label-1", type: "LABEL", title: "人物角色" },
  "wiki-1": {
    unitId: "wiki-1",
    type: "POST",
    postKind: "WIKI",
    title: "上條當麻",
  },
  "post-1": {
    unitId: "post-1",
    type: "POST",
    postKind: "REVIEW",
    title: "Review",
  },
  "book-1": { unitId: "book-1", type: "BOOK", title: "とある魔術の禁書目録" },
  "zone-1": {
    unitId: "zone-1",
    type: "ZONE",
    slug: "book",
    title: "Books",
  },
  "realm-1": {
    unitId: "realm-1",
    type: "REALM",
    slug: "toaru",
    title: "とある",
  },
  "untitled-label": { unitId: "untitled-label", type: "LABEL", title: null },
};

const pages = [
  { id: "home", slug: "home", position: "a" },
  { id: "search", slug: "search", position: "b" },
  { id: "feed", slug: "feed", position: "c" },
];

const ctx = {
  routeLocation: { kind: "slug" as const, zoneSlug: "toaru" },
  pages,
  refUnits,
};
const unitCtx = {
  routeLocation: { kind: "unitId" as const, zoneUnitId: "zone-toaru" },
  pages,
  refUnits,
};

describe("zoneDetailKindForRef", () => {
  it("routes WIKI posts to wiki, other posts to post, the rest to unit", () => {
    expect(zoneDetailKindForRef(refUnits["wiki-1"])).toBe("wiki");
    expect(zoneDetailKindForRef(refUnits["post-1"])).toBe("post");
    expect(zoneDetailKindForRef(refUnits["book-1"])).toBe("unit");
    expect(zoneDetailKindForRef(undefined)).toBe("unit");
  });
});

describe("zoneLinkHref", () => {
  it("keeps posts in the zone frame and routes catalog units canonically", () => {
    expect(zoneLinkHref({ kind: "unit", unitId: "wiki-1" }, ctx)).toBe(
      "/z/toaru/wiki/wiki-1",
    );
    expect(zoneLinkHref({ kind: "unit", unitId: "post-1" }, ctx)).toBe(
      "/z/toaru/post/post-1",
    );
    expect(zoneLinkHref({ kind: "unit", unitId: "book-1" }, ctx)).toBe(
      "/book/book-1",
    );
    expect(zoneLinkHref({ kind: "unit", unitId: "realm-1" }, ctx)).toBe(
      "/r/toaru",
    );
    expect(zoneLinkHref({ kind: "unit", unitId: "zone-1" }, ctx)).toBe(
      "/z/book",
    );
  });

  it("keeps zone-framed links on the unitId route when no slug is available", () => {
    expect(zoneLinkHref({ kind: "unit", unitId: "wiki-1" }, unitCtx)).toBe(
      "/zone/zone-toaru/wiki/wiki-1",
    );
    expect(zoneLinkHref({ kind: "unit", unitId: "post-1" }, unitCtx)).toBe(
      "/zone/zone-toaru/post/post-1",
    );
  });

  it("builds canonical hrefs for hydrated section items", () => {
    expect(zoneSectionItemHref(refUnits["wiki-1"]!, "toaru")).toBe(
      "/z/toaru/wiki/wiki-1",
    );
    expect(zoneSectionItemHref(refUnits["post-1"]!, "toaru")).toBe(
      "/z/toaru/post/post-1",
    );
    expect(zoneSectionItemHref(refUnits["book-1"]!, "toaru")).toBe(
      "/book/book-1",
    );
    expect(
      zoneSectionItemHref({ unitId: "poll-1", type: "POLL" }, "toaru"),
    ).toBe("/poll/poll-1");
  });

  it("builds zone page hrefs from page summaries", () => {
    expect(zonePageHref("home", "toaru", pages)).toBe("/z/toaru");
    expect(zonePageHref("search", "toaru", pages)).toBe("/z/toaru/page/search");
    expect(zonePageHref("feed", "toaru", pages)).toBe("/z/toaru/page/feed");
    expect(zonePageHref("missing", "toaru", pages)).toBeNull();
    expect(zoneLinkHref({ kind: "zonePage", pageId: "search" }, ctx)).toBe(
      "/z/toaru/page/search",
    );
    expect(zonePageHref("home", unitCtx.routeLocation, pages)).toBe(
      "/zone/zone-toaru",
    );
    expect(zonePageHref("search", unitCtx.routeLocation, pages)).toBe(
      "/zone/zone-toaru/page/search",
    );
  });

  it("passes external urls through", () => {
    expect(
      zoneLinkHref(
        { kind: "external", url: "https://example.com", text: "QQ 123" },
        ctx,
      ),
    ).toBe("https://example.com");
  });
});

describe("zoneLinkLabel", () => {
  it("prefers the LABEL unit title", () => {
    expect(
      zoneLinkLabel(
        { labelUnitId: "label-1", target: { kind: "unit", unitId: "wiki-1" } },
        refUnits,
      ),
    ).toBe("人物角色");
  });

  it("falls back to the target unit title", () => {
    expect(
      zoneLinkLabel({ target: { kind: "unit", unitId: "wiki-1" } }, refUnits),
    ).toBe("上條當麻");
    expect(
      zoneLinkLabel(
        {
          labelUnitId: "untitled-label",
          target: { kind: "unit", unitId: "wiki-1" },
        },
        refUnits,
      ),
    ).toBe("上條當麻");
  });

  it("falls back to external text and finally null", () => {
    expect(
      zoneLinkLabel(
        { target: { kind: "external", url: "https://x", text: "QQ 123" } },
        refUnits,
      ),
    ).toBe("QQ 123");
    expect(
      zoneLinkLabel({ target: { kind: "zonePage", pageId: "home" } }, refUnits),
    ).toBeNull();
  });

  it("exposes i18n fallback keys only for zone pages", () => {
    expect(zoneLinkFallbackKey({ kind: "zonePage", pageId: "feed" })).toBe(
      "zone:page_feed",
    );
    expect(zoneLinkFallbackKey({ kind: "unit", unitId: "wiki-1" })).toBeNull();
    expect(zoneLinkFallbackKey(undefined)).toBeNull();
  });
});

describe("resolveZoneMenuNodes", () => {
  it("projects labels, hrefs, and children", () => {
    const nodes: ZoneMenuNode[] = [
      {
        id: "group",
        labelUnitId: "label-1",
        children: [
          { id: "leaf", target: { kind: "unit", unitId: "wiki-1" } },
          {
            id: "page",
            target: { kind: "zonePage", pageId: "search" },
          },
        ],
      },
    ];
    const resolved = resolveZoneMenuNodes(nodes, ctx);
    expect(resolved).toEqual([
      {
        id: "group",
        label: "人物角色",
        labelKey: null,
        href: null,
        isExternal: false,
        children: [
          {
            id: "leaf",
            label: "上條當麻",
            labelKey: null,
            href: "/z/toaru/wiki/wiki-1",
            isExternal: false,
            children: [],
          },
          {
            id: "page",
            label: null,
            labelKey: "zone:page_search",
            href: "/z/toaru/page/search",
            isExternal: false,
            children: [],
          },
        ],
      },
    ]);
  });

  it("uses page slugs rather than opaque page ids for built-in page labels", () => {
    const resolved = resolveZoneMenuNodes(
      [{ id: "home-node", target: { kind: "zonePage", pageId: "page-home" } }],
      {
        ...ctx,
        pages: [{ id: "page-home", slug: "home", position: "a" }],
      },
    );

    expect(resolved[0]?.labelKey).toBe("zone:page_home");
  });

  it("clamps the tree at depth 3", () => {
    const nodes: ZoneMenuNode[] = [
      {
        id: "d1",
        labelUnitId: "label-1",
        children: [
          {
            id: "d2",
            labelUnitId: "label-1",
            children: [
              {
                id: "d3",
                labelUnitId: "label-1",
                children: [{ id: "d4", labelUnitId: "label-1" }],
              },
            ],
          },
        ],
      },
    ];
    const resolved = resolveZoneMenuNodes(nodes, ctx);
    const d3 = resolved[0]?.children[0]?.children[0];
    expect(d3?.id).toBe("d3");
    expect(d3?.children).toEqual([]);
  });
});

describe("pickZoneMenu", () => {
  const nav = {
    schema: "rezics/zone-nav" as const,
    version: 1 as const,
    header: { menuId: "main" },
    menus: [
      { id: "main", nodes: [] },
      { id: "sidebar", nodes: [] },
    ],
  };

  it("uses an explicit menu id when present", () => {
    expect(pickZoneMenu(nav, "sidebar")?.id).toBe("sidebar");
  });

  it("falls back to the header menu when no explicit menu is selected", () => {
    expect(pickZoneMenu(nav)?.id).toBe("main");
  });

  it("falls back to the header menu when the explicit id is unknown", () => {
    expect(pickZoneMenu(nav, "missing")?.id).toBe("main");
  });

  it("returns null when neither explicit nor header menu resolves", () => {
    expect(
      pickZoneMenu({ ...nav, header: { menuId: "missing" } }, "unknown"),
    ).toBeNull();
  });
});

describe("section titles", () => {
  it("resolves explicit titleLabelUnitId through refUnits", () => {
    expect(
      zoneSectionTitleText({ titleLabelUnitId: "label-1" }, refUnits),
    ).toBe("人物角色");
    expect(zoneSectionTitleText({}, refUnits)).toBeNull();
    expect(
      zoneSectionTitleText({ titleLabelUnitId: "missing" }, refUnits),
    ).toBeNull();
  });

  it("maps content kinds to default i18n keys; stage chrome has none", () => {
    expect(zoneSectionTitleKey("query")).toBe("zone:section_title_query");
    expect(zoneSectionTitleKey("collection")).toBe(
      "zone:section_title_collection",
    );
    expect(zoneSectionTitleKey("feed")).toBe("zone:section_title_feed");
    expect(zoneSectionTitleKey("richText")).toBe("zone:section_title_richText");
    expect(zoneSectionTitleKey("stats")).toBe("zone:section_title_stats");
    expect(zoneSectionTitleKey("sources")).toBe("zone:section_title_sources");
    expect(zoneSectionTitleKey("stage")).toBeNull();
    expect(zoneSectionTitleKey("zoneInfo")).toBeNull();
    expect(zoneSectionTitleKey("image")).toBeNull();
    expect(zoneSectionTitleKey("actions")).toBeNull();
    expect(zoneSectionTitleKey("tabs")).toBeNull();
    expect(zoneSectionTitleKey("columns")).toBeNull();
  });
});

describe("context CTA routing", () => {
  const realmContext = {
    context: { kind: "realm", realmUnitId: "realm-1" } as const,
  };
  const globalContext = { context: { kind: "global" } as const };

  it("routes create CTAs to the context realm create flow", () => {
    expect(zoneCreateHref(realmContext, refUnits, "wiki")).toBe(
      "/r/toaru/create?mode=wiki",
    );
    expect(zoneCreateHref(realmContext, refUnits, "post")).toBe(
      "/r/toaru/create?mode=post",
    );
    expect(zoneCreateHref(globalContext, refUnits, "wiki")).toBeNull();
  });

  it("routes the join CTA to the context realm page", () => {
    expect(zoneJoinHref(realmContext, refUnits)).toBe("/r/toaru");
    expect(zoneJoinHref(globalContext, refUnits)).toBeNull();
    expect(
      zoneJoinHref(
        { context: { kind: "realm", realmUnitId: "unknown" } },
        refUnits,
      ),
    ).toBeNull();
  });
});
