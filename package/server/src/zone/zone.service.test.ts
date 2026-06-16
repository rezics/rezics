import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { ZoneConfig } from "@rezics/contract";
import type { ZoneRepository, ZoneWithRelations } from "./zone.service";

const unitRows = new Map<string, { id: string; type: string }>([
  ["realm-1", { id: "realm-1", type: "REALM" }],
  ["realm-2", { id: "realm-2", type: "REALM" }],
  ["label-1", { id: "label-1", type: "LABEL" }],
  ["image-1", { id: "image-1", type: "IMAGE" }],
  ["entity-1", { id: "entity-1", type: "ENTITY" }],
  ["book-1", { id: "book-1", type: "BOOK" }],
  ["fragment-1", { id: "fragment-1", type: "POST" }],
  ["post-1", { id: "post-1", type: "POST" }],
]);

const postKinds = new Map<string, string>([
  ["fragment-1", "WIKI"],
  ["post-1", "REMARK"],
]);

const hydratedUnits = new Map<string, any>([
  [
    "book-1",
    {
      id: "book-1",
      type: "BOOK",
      slug: "index-1",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      translations: [
        { language: "en", title: "A Certain Index", summary: null },
        { language: "zh-hant", title: "魔法禁書目錄", summary: null },
      ],
      supportLanguages: [
        { language: "en", isPrimary: true, sortOrder: 0 },
        { language: "zh-hant", isPrimary: false, sortOrder: 1 },
      ],
    },
  ],
  [
    "post-1",
    {
      id: "post-1",
      type: "POST",
      slug: null,
      createdAt: new Date("2026-02-01T00:00:00.000Z"),
      updatedAt: new Date("2026-02-02T00:00:00.000Z"),
      translations: [{ language: "en", title: "Hot thread", summary: null }],
      supportLanguages: [{ language: "en", isPrimary: true, sortOrder: 0 }],
      post: { kind: "REMARK" },
    },
  ],
  [
    "label-1",
    {
      id: "label-1",
      type: "LABEL",
      translations: [
        { language: "en", title: "Characters" },
        { language: "zh-hant", title: "人物角色" },
      ],
      supportLanguages: [
        { language: "en", isPrimary: true, sortOrder: 0 },
        { language: "zh-hant", isPrimary: false, sortOrder: 1 },
      ],
    },
  ],
]);

const fragmentTranslations = new Map<
  string,
  Array<{ language: string; content: unknown }>
>([
  [
    "fragment-1",
    [
      {
        language: "en",
        content: {
          schema: "rezics.content",
          version: 1,
          main: { type: "markdown", source: "Welcome" },
        },
      },
      {
        language: "zh-hant",
        content: {
          schema: "rezics.content",
          version: 1,
          main: { type: "markdown", source: "歡迎" },
        },
      },
    ],
  ],
]);

const searchSectionMock = mock(
  async (_input: {
    index: "content" | "posts";
    filter: string[];
    sort: string[];
    offset: number;
    limit: number;
  }): Promise<{ ids: string[]; total: number }> => ({
    ids: ["book-1"],
    total: 1,
  }),
);
const replaceTranslationsMock = mock(async () => undefined);
const updateZoneDataMock = mock(async (): Promise<void> => undefined);

function baseConfig(): ZoneConfig {
  return {
    schema: "rezics/zone-config",
    version: 1,
    context: { kind: "realm", realmUnitId: "realm-1" },
    filters: {},
    menus: [
      {
        id: "main",
        nodes: [
          {
            id: "group-characters",
            labelUnitId: "label-1",
            children: [
              { id: "entity", target: { kind: "unit", unitId: "entity-1" } },
            ],
          },
        ],
      },
    ],
    header: { menuId: "main" },
    pages: {
      home: {
        sections: [
          { id: "s-hero", kind: "hero", bannerImageUnitId: "image-1" },
          {
            id: "s-columns",
            kind: "columns",
            main: [
              { id: "s-notice", kind: "richText", contentUnitId: "fragment-1" },
              {
                id: "s-tabs",
                kind: "tabs",
                tabs: [
                  {
                    id: "tab-new",
                    sections: [
                      {
                        id: "s-new",
                        kind: "query",
                        display: "covers",
                        limit: 2,
                        query: {
                          target: "unit",
                          types: ["BOOK"],
                          realm: "context",
                          languages: "viewer",
                          sort: { field: "publishedAt", direction: "desc" },
                        },
                      },
                    ],
                  },
                  {
                    id: "tab-hot",
                    sections: [{ id: "s-feed", kind: "feed", feedKind: "all" }],
                  },
                ],
              },
            ],
            side: [
              {
                id: "s-stats",
                kind: "stats",
                metrics: ["articles", "members"],
              },
              {
                id: "s-collection",
                kind: "collection",
                display: "list",
                items: [
                  { target: { kind: "unit", unitId: "book-1" } },
                  {
                    target: {
                      kind: "external",
                      url: "https://example.com",
                      text: "QQ 12345",
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    },
    theme: { images: { logoUnitId: "image-1" } },
  };
}

function zoneRow(config: ZoneConfig): ZoneWithRelations {
  return {
    unitId: "zone-1",
    ownerRealmUnitId: "realm-1",
    config,
    startsAt: null,
    endsAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    unit: {
      translations: [],
      supportLanguages: [],
    } as unknown as ZoneWithRelations["unit"],
  } as ZoneWithRelations;
}

let currentZone: ZoneWithRelations | null = null;

function createMockRepository(): ZoneRepository {
  return {
    async findUnitRefs(ids) {
      return ids.flatMap((id) => {
        const row = unitRows.get(id);
        return row ? [row] : [];
      });
    },
    async findPostKinds(ids) {
      return ids.flatMap((id) => {
        const kind = postKinds.get(id);
        return kind ? [{ unitId: id, kind }] : [];
      });
    },
    async getByUnitId(unitId) {
      return currentZone && currentZone.unitId === unitId ? currentZone : null;
    },
    async findUnitBySlug() {
      return null;
    },
    async createZone(data) {
      return zoneRow(data.config);
    },
    async updateZone(unitId, data) {
      await updateZoneDataMock();
      return { ...(currentZone ?? zoneRow(baseConfig())), ...data, unitId };
    },
    async replaceTranslations(unitId, translations) {
      await replaceTranslationsMock(unitId, translations);
    },
    async hydrateUnits(unitIds) {
      const map = new Map<string, any>();
      for (const id of unitIds) {
        const row = hydratedUnits.get(id);
        if (row) map.set(id, row);
      }
      return map;
    },
    async findFragmentTranslations(unitId) {
      return fragmentTranslations.get(unitId) ?? [];
    },
    searchSection: searchSectionMock,
    async countWikiArticles() {
      return 42;
    },
    async getRealmMemberCount() {
      return 7;
    },
    async deleteUnit() {},
  };
}

import { parseZoneRowConfig, ZoneService } from "./zone.service";

let service: ZoneService;

beforeEach(() => {
  searchSectionMock.mockClear();
  replaceTranslationsMock.mockClear();
  updateZoneDataMock.mockClear();
  currentZone = zoneRow(baseConfig());
  service = new ZoneService(createMockRepository());
});

async function expectValidationCode(config: ZoneConfig, code: string) {
  expect.assertions(1);
  try {
    await service.validateZoneConfig(config);
  } catch (error: any) {
    expect(error.options?.code ?? error.code).toBe(code);
  }
}

describe("zone config validation", () => {
  test("accepts the base config", async () => {
    await service.validateZoneConfig(baseConfig());
  });

  test("rejects duplicate section ids across containers", async () => {
    const config = baseConfig();
    config.pages.home.sections.push({
      id: "s-new",
      kind: "feed",
    });
    await expectValidationCode(config, "ZONE_SECTION_ID_DUPLICATE");
  });

  test("rejects menus deeper than three levels", async () => {
    const config = baseConfig();
    config.menus[0]!.nodes = [
      {
        id: "l1",
        labelUnitId: "label-1",
        children: [
          {
            id: "l2",
            labelUnitId: "label-1",
            children: [
              {
                id: "l3",
                labelUnitId: "label-1",
                children: [
                  { id: "l4", target: { kind: "unit", unitId: "entity-1" } },
                ],
              },
            ],
          },
        ],
      },
    ];
    await expectValidationCode(config, "ZONE_MENU_TOO_DEEP");
  });

  test("rejects leaf menu nodes without a target", async () => {
    const config = baseConfig();
    config.menus[0]!.nodes.push({ id: "dangling" });
    await expectValidationCode(config, "ZONE_MENU_NODE_INVALID");
  });

  test("rejects a header pointing at a missing menu", async () => {
    const config = baseConfig();
    config.header.menuId = "missing";
    await expectValidationCode(config, "ZONE_HEADER_MENU_INVALID");
  });

  test("rejects defaultTabId outside the tab set", async () => {
    const config = baseConfig();
    const columns = config.pages.home.sections[1] as Extract<
      ZoneConfig["pages"]["home"]["sections"][number],
      { kind: "columns" }
    >;
    const tabs = columns.main[1] as Extract<
      (typeof columns.main)[number],
      { kind: "tabs" }
    >;
    tabs.defaultTabId = "missing-tab";
    await expectValidationCode(config, "ZONE_TAB_DEFAULT_INVALID");
  });

  test("rejects non-LABEL labelUnitId refs", async () => {
    const config = baseConfig();
    config.menus[0]!.nodes[0]!.labelUnitId = "entity-1";
    await expectValidationCode(config, "ZONE_LABEL_REF_INVALID");
  });

  test("rejects non-IMAGE theme/hero image refs", async () => {
    const config = baseConfig();
    config.theme.images = { logoUnitId: "book-1" };
    await expectValidationCode(config, "ZONE_IMAGE_REF_INVALID");
  });

  test("rejects non-REALM context refs", async () => {
    const config = baseConfig();
    config.context = { kind: "realm", realmUnitId: "book-1" };
    await expectValidationCode(config, "ZONE_REALM_REF_INVALID");
  });

  test("rejects non-REALM query realm ids", async () => {
    const config = baseConfig();
    config.filters = { realm: { unitIds: ["entity-1"] } };
    await expectValidationCode(config, "ZONE_REALM_REF_INVALID");
  });

  test("rejects richText fragments that are not WIKI posts", async () => {
    const config = baseConfig();
    const columns = config.pages.home.sections[1] as Extract<
      ZoneConfig["pages"]["home"]["sections"][number],
      { kind: "columns" }
    >;
    (columns.main[0] as { contentUnitId: string }).contentUnitId = "post-1";
    await expectValidationCode(config, "ZONE_FRAGMENT_REF_INVALID");
  });

  test("rejects missing menu/collection unit targets", async () => {
    const config = baseConfig();
    config.menus[0]!.nodes.push({
      id: "ghost",
      target: { kind: "unit", unitId: "missing-unit" },
    });
    await expectValidationCode(config, "ZONE_UNIT_REF_INVALID");
  });

  test("rejects query fields the target index cannot filter", async () => {
    const config = baseConfig();
    config.pages.home.sections.push({
      id: "s-bad-query",
      kind: "query",
      display: "list",
      query: {
        target: "post",
        tagUnitIds: ["tag-1"],
        sort: { field: "createdAt" },
      },
    });
    await expectValidationCode(config, "ZONE_QUERY_FIELD_UNSUPPORTED");
  });
});

describe("upgrade-on-read", () => {
  test("parses a valid v1 envelope before business code sees it", () => {
    const config = parseZoneRowConfig({
      unitId: "zone-1",
      config: baseConfig(),
    });
    expect(config.version).toBe(1);
    expect(config.context).toEqual({ kind: "realm", realmUnitId: "realm-1" });
  });

  test("throws ZONE_CONFIG_INVALID for legacy six-column shapes", () => {
    expect(() =>
      parseZoneRowConfig({
        unitId: "zone-legacy",
        config: { filters: {}, configVersion: 1, template: "wiki-classic" },
      }),
    ).toThrow("Zone config failed envelope validation");
  });
});

describe("zone update", () => {
  test("replaces translations through the repository on update", async () => {
    await service.update("zone-1", {
      translations: [
        { language: "en", title: "Toaru Wiki" },
        { language: "zh-hant", title: "魔禁百科" },
      ],
    });
    expect(replaceTranslationsMock).toHaveBeenCalledWith("zone-1", [
      { language: "en", title: "Toaru Wiki" },
      { language: "zh-hant", title: "魔禁百科" },
    ]);
  });

  test("rejects an empty translations array", async () => {
    expect(service.update("zone-1", { translations: [] })).rejects.toThrow(
      "Zones require at least one translation",
    );
  });

  test("validates the envelope before persisting config", async () => {
    const config = baseConfig();
    config.header.menuId = "missing";
    expect(service.update("zone-1", { config })).rejects.toThrow(
      "header.menuId must reference a menu",
    );
    expect(updateZoneDataMock).not.toHaveBeenCalled();
  });
});

describe("section data execution", () => {
  test("query sections compile through the boundary and hydrate items", async () => {
    const data = await service.getSectionData("zone-1", "s-new", {
      preferredLanguages: ["zh-hant"],
    });
    expect(searchSectionMock).toHaveBeenCalledTimes(1);
    const input = searchSectionMock.mock.calls[0]![0];
    expect(input.index).toBe("content");
    expect(input.filter).toContain('type = "BOOK"');
    // `realm: "context"` resolves to the zone's realm context
    expect(input.filter).toContain('realmIds = "realm-1"');
    // UNLISTED exclusion: unit queries are PUBLIC-only
    expect(input.filter).toContain('visibility = "PUBLIC"');
    expect(input.sort).toEqual(["publishedAt:desc"]);
    expect(input.limit).toBe(2);
    expect(data?.items).toEqual([
      expect.objectContaining({
        unitId: "book-1",
        title: "魔法禁書目錄",
        language: "zh-hant",
      }),
    ]);
    expect(data?.nextCursor).toBeNull();
  });

  test("query sections intersect with the zone boundary filter", async () => {
    const config = baseConfig();
    config.filters = { types: ["SERIES"], ratings: ["GENERAL"] };
    currentZone = zoneRow(config);

    await service.getSectionData("zone-1", "s-new");
    const input = searchSectionMock.mock.calls[0]![0];
    // section asks for BOOK, boundary allows SERIES only → empty intersection
    expect(
      input.filter.some((clause: string) =>
        clause.includes("__zone_boundary_empty_intersection__"),
      ),
    ).toBe(true);
    expect(input.filter).toContain('rating = "GENERAL"');
  });

  test("query sections continue with an offset cursor", async () => {
    searchSectionMock.mockResolvedValueOnce({ ids: ["book-1"], total: 5 });
    const data = await service.getSectionData("zone-1", "s-new", {
      cursor: "2",
    });
    const input = searchSectionMock.mock.calls[0]![0];
    expect(input.offset).toBe(2);
    expect(data?.nextCursor).toBe("4");
  });

  test("feed sections execute as posts-index query presets", async () => {
    searchSectionMock.mockResolvedValueOnce({ ids: ["post-1"], total: 1 });
    const data = await service.getSectionData("zone-1", "s-feed");
    const input = searchSectionMock.mock.calls[0]![0];
    expect(input.index).toBe("posts");
    expect(input.sort).toEqual(["hotScore:desc"]);
    expect(input.filter).toContain('realmIds = "realm-1"');
    expect(data?.items[0]?.postKind).toBe("REMARK");
  });

  test("collection sections resolve unit targets in config order", async () => {
    const data = await service.getSectionData("zone-1", "s-collection");
    expect(searchSectionMock).not.toHaveBeenCalled();
    expect(data?.items.map((item) => item.unitId)).toEqual(["book-1"]);
    expect(data?.nextCursor).toBeNull();
  });

  test("stats sections aggregate context-realm metrics", async () => {
    const data = await service.getSectionData("zone-1", "s-stats");
    expect(data?.stats).toEqual({ articles: 42, members: 7 });
  });

  test("richText sections resolve the fragment doc by reader language", async () => {
    const data = await service.getSectionData("zone-1", "s-notice", {
      preferredLanguages: ["zh-hant"],
    });
    expect(data?.docLanguage).toBe("zh-hant");
    expect((data?.doc as any)?.main?.source).toBe("歡迎");
  });

  test("container and hero sections expose no data endpoint", async () => {
    expect(service.getSectionData("zone-1", "s-tabs")).rejects.toThrow(
      "Container sections have no section data",
    );
    expect(service.getSectionData("zone-1", "s-hero")).rejects.toThrow(
      "Hero sections have no section data",
    );
  });

  test("unknown sections return null", async () => {
    expect(await service.getSectionData("zone-1", "nope")).toBeNull();
  });
});

describe("portal ref units", () => {
  test("batches summaries for every config-referenced unit", async () => {
    const refUnits = await service.getPortalRefUnits(currentZone!, {
      preferredLanguages: ["en"],
    });
    expect(refUnits["label-1"]).toEqual(
      expect.objectContaining({ unitId: "label-1", title: "Characters" }),
    );
    expect(refUnits["book-1"]).toEqual(
      expect.objectContaining({ unitId: "book-1", title: "A Certain Index" }),
    );
  });
});
