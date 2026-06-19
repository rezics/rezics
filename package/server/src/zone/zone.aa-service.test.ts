import { beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import type {
  ZoneBoundary,
  ZoneNav,
  ZonePage as ZonePageConfig,
  ZoneTheme,
} from "@rezics/contract";
import type {
  ZonePageWithConfig,
  ZoneRepository,
  ZoneWithRelations,
} from "./zone.service";

const unitRows = new Map<string, { id: string; type: string }>([
  ["realm-1", { id: "realm-1", type: "REALM" }],
  ["label-1", { id: "label-1", type: "LABEL" }],
  ["entity-1", { id: "entity-1", type: "ENTITY" }],
  ["book-1", { id: "book-1", type: "BOOK" }],
  ["fragment-1", { id: "fragment-1", type: "POST" }],
  ["post-1", { id: "post-1", type: "POST" }],
]);

const postKinds = new Map<string, string>([
  ["fragment-1", "WIKI"],
  ["post-1", "REMARK"],
]);

const testNodeId = (suffix: number) =>
  `00000000-0000-4000-8000-${String(suffix).padStart(12, "0")}`;

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
        { language: "en", isPrimary: true, position: "a" },
        { language: "zh-hant", isPrimary: false, position: "b" },
      ],
    },
  ],
  [
    "realm-2",
    {
      id: "realm-2",
      type: "REALM",
      slug: "academy-city",
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
      updatedAt: new Date("2026-03-02T00:00:00.000Z"),
      translations: [{ language: "en", title: "Academy City", summary: null }],
      supportLanguages: [{ language: "en", isPrimary: true, position: "a" }],
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
      supportLanguages: [{ language: "en", isPrimary: true, position: "a" }],
      post: { kind: "REMARK" },
    },
  ],
  [
    "zone-2",
    {
      id: "zone-2",
      type: "ZONE",
      slug: "featured-zone",
      createdAt: new Date("2026-04-01T00:00:00.000Z"),
      updatedAt: new Date("2026-04-02T00:00:00.000Z"),
      translations: [
        { language: "en", title: "Featured Zone", summary: "A portal" },
      ],
      supportLanguages: [{ language: "en", isPrimary: true, position: "a" }],
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
        { language: "en", isPrimary: true, position: "a" },
        { language: "zh-hant", isPrimary: false, position: "b" },
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
    index: "content" | "posts" | "realms" | "zones";
    filter: string[];
    sort: string[];
    offset: number;
    limit: number;
  }): Promise<{ ids: string[]; total: number }> => ({
    ids: ["book-1"],
    total: 1,
  }),
);
const postListMock = mock(async () => ({
  posts: [{ unitId: "post-1", kind: "REMARK" }],
  total: 1,
}));
const bookListMock = mock(
  async (): Promise<{ books: any[]; total: number }> => ({
    books: [],
    total: 0,
  }),
);
const mapBookToDTOMock = mock((book: any) => book);
const mapPostToDTOMock = mock((post: { unitId: string; kind?: string }) => ({
  unitId: post.unitId,
  authorUserId: "user-1",
  author: null,
  targetUnitId: null,
  variantUnitId: null,
  variantContext: null,
  realmUnitId: null,
  referenceCount: 0,
  resolvedLanguage: "en",
  title: "Hot thread",
  content: null,
  kind: post.kind ?? null,
  status: "PUBLISHED",
  visibility: "PUBLIC",
  licenseSlug: null,
  moderationStatus: "normal",
  isTombstone: false,
  scoreEntryId: null,
  replyCount: 0,
  directReplyCount: 0,
  lastReplyAt: null,
  isLocked: false,
  state: null,
  pinKind: null,
  pinPosition: null,
  extra: null,
  createdAt: "2026-02-01T00:00:00.000Z",
  updatedAt: "2026-02-02T00:00:00.000Z",
}));
const replaceTranslationsMock = mock(async (..._args: unknown[]) => undefined);
const updateZoneDataMock = mock(async (): Promise<void> => undefined);
const listSubscribedZoneIdsMock = mock(async () => ({
  unitIds: ["zone-1"],
  total: 1,
}));
const listManageableZoneIdsMock = mock(async () => ({
  unitIds: ["zone-1"],
  total: 1,
}));

function baseBoundary(): ZoneBoundary {
  return {
    schema: "rezics/zone-boundary",
    version: 1,
    context: { kind: "realm", realmUnitId: "realm-1" },
    filters: {},
  };
}

function baseNav(): ZoneNav {
  return {
    schema: "rezics/zone-nav",
    version: 1,
    menus: [
      {
        slug: "main",
        nodes: [
          {
            labelUnitId: "label-1",
            children: [{ target: { kind: "unit", unitId: "entity-1" } }],
          },
        ],
      },
    ],
    header: { menuSlug: "main" },
  };
}

function baseTheme(): ZoneTheme {
  return {
    schema: "rezics/zone-theme",
    version: 1,
  };
}

function basePage(): ZonePageConfig {
  return {
    schema: "rezics/page",
    version: 1,
    sections: [
      {
        nodeId: testNodeId(1),
        slug: "stage",
        kind: "stage",
        background: { imageUrl: "https://example.com/a.jpg" },
        sections: [
          { nodeId: testNodeId(2), kind: "zoneInfo" },
          {
            nodeId: testNodeId(3),
            slug: "image",
            kind: "image",
            url: "https://example.com/logo.jpg",
          },
        ],
      },
      {
        nodeId: testNodeId(4),
        slug: "columns",
        kind: "columns",
        columns: [
          {
            ratio: 3,
            sections: [
              {
                nodeId: testNodeId(5),
                slug: "notice",
                kind: "richText",
                contentUnitId: "fragment-1",
              },
              {
                nodeId: testNodeId(6),
                slug: "tabs",
                kind: "tabs",
                tabs: [
                  {
                    nodeId: testNodeId(7),
                    slug: "new",
                    sections: [
                      {
                        nodeId: testNodeId(8),
                        slug: "new-books",
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
                    nodeId: testNodeId(9),
                    slug: "hot",
                    sections: [
                      {
                        nodeId: testNodeId(10),
                        slug: "feed",
                        kind: "stream",
                        streamKind: "all",
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            ratio: 1,
            sections: [
              {
                nodeId: testNodeId(11),
                slug: "stats",
                kind: "stats",
                metrics: ["articles", "members"],
              },
              {
                nodeId: testNodeId(12),
                slug: "collection",
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
    ],
  };
}

function pageRow(config: ZonePageConfig = basePage()): ZonePageWithConfig {
  return {
    id: "page-home",
    zoneUnitId: "zone-1",
    slug: "home",
    position: "a",
    config,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

function zoneRow(
  input: {
    boundary?: ZoneBoundary;
    nav?: ZoneNav;
    theme?: ZoneTheme;
    page?: ZonePageConfig;
  } = {},
): ZoneWithRelations {
  return {
    unitId: "zone-1",
    ownerRealmUnitId: "realm-1",
    boundary: input.boundary ?? baseBoundary(),
    nav: input.nav ?? baseNav(),
    theme: input.theme ?? baseTheme(),
    homePageId: "page-home",
    pages: [pageRow(input.page)],
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
let currentPage: ZonePageWithConfig = pageRow();

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
    listSubscribedZoneIds: listSubscribedZoneIdsMock,
    listManageableZoneIds: listManageableZoneIdsMock,
    async findPageBySlug(_zoneUnitId, slug) {
      return currentPage.slug === slug ? currentPage : null;
    },
    async getPage(_zoneUnitId, pageId) {
      return currentPage.id === pageId ? currentPage : null;
    },
    async findUnitBySlug() {
      return null;
    },
    async createZone(data) {
      currentPage = pageRow(data.homePage);
      currentZone = zoneRow({
        boundary: data.boundary,
        nav: data.nav,
        theme: data.theme,
        page: data.homePage,
      });
      return currentZone;
    },
    async updateZone(unitId, data) {
      await updateZoneDataMock();
      currentZone = { ...(currentZone ?? zoneRow()), ...data, unitId };
      return currentZone;
    },
    async updateZoneBoundary(unitId, boundary) {
      await updateZoneDataMock();
      currentZone = { ...(currentZone ?? zoneRow()), boundary, unitId };
      return currentZone;
    },
    async updateZoneNav(unitId, nav) {
      await updateZoneDataMock();
      currentZone = { ...(currentZone ?? zoneRow()), nav, unitId };
      return currentZone;
    },
    async updateZoneTheme(unitId, theme) {
      await updateZoneDataMock();
      currentZone = { ...(currentZone ?? zoneRow()), theme, unitId };
      return currentZone;
    },
    async createPage() {
      return currentZone ?? zoneRow();
    },
    async updatePage() {
      return currentZone ?? zoneRow();
    },
    async deletePage() {
      return currentZone ?? zoneRow();
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

let ZoneServiceCtor: typeof import("./zone.service").ZoneService;
let service: import("./zone.service").ZoneService;

beforeAll(async () => {
  mock.restore();
  const filters = await import("../meili/search/filters");
  mock.module("@/meili/search/filters", () => filters);
  mock.module("@/job/job-boundary", () => ({
    serverJobProducer: {
      enqueue: mock(async () => ({ status: "created" })),
    },
  }));
  mock.module("@/unit", () => ({ unitService: {} }));
  mock.module("../post", () => ({
    postService: { list: postListMock },
  }));
  mock.module("../post/post.mapper", () => ({
    mapPostToDTO: mapPostToDTOMock,
  }));
  mock.module("../book", () => ({
    bookService: { list: bookListMock },
    mapBookToDTO: mapBookToDTOMock,
  }));
  mock.module("@/utils/errors", () => ({
    AppError: class AppError extends Error {
      public readonly code?: string;
      public readonly details?: Record<string, unknown>;

      constructor(
        public readonly statusCode: number,
        message: string,
        options?: { code?: string; details?: Record<string, unknown> },
      ) {
        super(message);
        this.name = "AppError";
        this.code = options?.code;
        this.details = options?.details;
      }
    },
  }));
  const serviceModule = await import(
    new URL("./zone.service.ts", import.meta.url).href
  );
  ZoneServiceCtor = serviceModule.ZoneService;
});

beforeEach(() => {
  searchSectionMock.mockClear();
  postListMock.mockClear();
  bookListMock.mockClear();
  mapBookToDTOMock.mockClear();
  mapPostToDTOMock.mockClear();
  replaceTranslationsMock.mockClear();
  updateZoneDataMock.mockClear();
  listSubscribedZoneIdsMock.mockClear();
  listManageableZoneIdsMock.mockClear();
  currentPage = pageRow(basePage());
  currentZone = zoneRow({ page: currentPage.config });
  service = new ZoneServiceCtor(createMockRepository());
});

async function expectValidationCode(promise: Promise<unknown>, code: string) {
  let actualCode: unknown;
  try {
    await promise;
  } catch (error: any) {
    actualCode = error.options?.code ?? error.code;
  }
  expect(actualCode).toBe(code);
}

describe("zone split validation", () => {
  test("accepts the base shell and page", async () => {
    await service.validateZoneShell({
      boundary: baseBoundary(),
      nav: baseNav(),
      theme: baseTheme(),
    });
    await service.validateZonePage({
      boundary: baseBoundary(),
      nav: baseNav(),
      theme: baseTheme(),
      page: basePage(),
    });
  });

  test("rejects menus deeper than three levels", async () => {
    const nav = baseNav();
    nav.menus[0]!.nodes = [
      {
        labelUnitId: "label-1",
        children: [
          {
            labelUnitId: "label-1",
            children: [
              {
                labelUnitId: "label-1",
                children: [{ target: { kind: "unit", unitId: "entity-1" } }],
              },
            ],
          },
        ],
      },
    ];
    await expectValidationCode(
      service.validateZoneShell({
        boundary: baseBoundary(),
        nav,
        theme: baseTheme(),
      }),
      "ZONE_MENU_TOO_DEEP",
    );
  });

  test("rejects missing menu labels, missing header refs, and bad realm refs", async () => {
    const nav = baseNav();
    nav.menus[0]!.nodes.push({});
    await expectValidationCode(
      service.validateZoneShell({
        boundary: baseBoundary(),
        nav,
        theme: baseTheme(),
      }),
      "ZONE_MENU_NODE_INVALID",
    );

    const missingHeaderNav = baseNav();
    missingHeaderNav.header.menuSlug = "missing";
    await expectValidationCode(
      service.validateZoneShell({
        boundary: baseBoundary(),
        nav: missingHeaderNav,
        theme: baseTheme(),
      }),
      "ZONE_HEADER_MENU_INVALID",
    );

    const boundary = baseBoundary();
    boundary.context = { kind: "realm", realmUnitId: "book-1" };
    await expectValidationCode(
      service.validateZoneShell({
        boundary,
        nav: baseNav(),
        theme: baseTheme(),
      }),
      "ZONE_REALM_REF_INVALID",
    );
  });

  test("validates page-local section ids and nested tab defaults", async () => {
    const duplicate = basePage();
    duplicate.sections.push({
      nodeId: testNodeId(8),
      slug: "duplicate-new",
      kind: "stream",
    });
    await expectValidationCode(
      service.validateZonePage({
        boundary: baseBoundary(),
        nav: baseNav(),
        theme: baseTheme(),
        page: duplicate,
      }),
      "ZONE_SECTION_NODE_ID_DUPLICATE",
    );

    const badTab = basePage();
    const columns = badTab.sections[1] as Extract<
      ZonePageConfig["sections"][number],
      { kind: "columns" }
    >;
    const tabs = columns.columns[0]!.sections[1] as Extract<
      (typeof columns.columns)[number]["sections"][number],
      { kind: "tabs" }
    >;
    tabs.defaultTabNodeId = testNodeId(99);
    await expectValidationCode(
      service.validateZonePage({
        boundary: baseBoundary(),
        nav: baseNav(),
        theme: baseTheme(),
        page: badTab,
      }),
      "ZONE_TAB_DEFAULT_INVALID",
    );
  });

  test("rejects bad fragment refs and unsupported query fields", async () => {
    const badFragment = basePage();
    const columns = badFragment.sections[1] as Extract<
      ZonePageConfig["sections"][number],
      { kind: "columns" }
    >;
    (
      columns.columns[0]!.sections[0] as { contentUnitId: string }
    ).contentUnitId = "post-1";
    await expectValidationCode(
      service.validateZonePage({
        boundary: baseBoundary(),
        nav: baseNav(),
        theme: baseTheme(),
        page: badFragment,
      }),
      "ZONE_FRAGMENT_REF_INVALID",
    );

    const badQuery = basePage();
    badQuery.sections.push({
      nodeId: testNodeId(13),
      slug: "bad-query",
      kind: "query",
      display: "list",
      query: {
        target: "post",
        tagUnitIds: ["tag-1"],
        sort: { field: "createdAt" },
      },
    });
    await expectValidationCode(
      service.validateZonePage({
        boundary: baseBoundary(),
        nav: baseNav(),
        theme: baseTheme(),
        page: badQuery,
      }),
      "ZONE_QUERY_FIELD_UNSUPPORTED",
    );
  });
});

describe("zone update", () => {
  test("replaces translations through the repository on update", async () => {
    await service.update("zone-1", {
      translations: [
        { language: "en", title: "Toaru" },
        { language: "zh-hant", title: "魔禁百科" },
      ],
    });
    expect(replaceTranslationsMock).toHaveBeenCalledWith("zone-1", [
      { language: "en", title: "Toaru" },
      { language: "zh-hant", title: "魔禁百科" },
    ]);
  });

  test("validates nav before persisting shell updates", async () => {
    const nav = baseNav();
    nav.header.menuSlug = "missing";
    expect(service.updateNav("zone-1", nav)).rejects.toThrow(
      "header.menuSlug must reference a menu",
    );
    expect(updateZoneDataMock).not.toHaveBeenCalled();
  });
});

describe("zone user lists", () => {
  test("lists subscribed zones through subscription list entries", async () => {
    const result = await service.listByUser({
      userUnitId: "user-1",
      view: "subscribed",
      publicOnly: true,
      start: 5,
      limit: 25,
    });

    expect(listSubscribedZoneIdsMock).toHaveBeenCalledWith({
      userUnitId: "user-1",
      publicOnly: true,
      offset: 5,
      limit: 25,
    });
    expect(listManageableZoneIdsMock).not.toHaveBeenCalled();
    expect(result.zones.map((zone) => zone.unitId)).toEqual(["zone-1"]);
    expect(result.total).toBe(1);
  });

  test("lists manageable zones through owner realm authority", async () => {
    await service.listByUser({
      userUnitId: "user-1",
      view: "managing",
      publicOnly: false,
    });

    expect(listManageableZoneIdsMock).toHaveBeenCalledWith({
      userUnitId: "user-1",
      publicOnly: false,
      offset: 0,
      limit: 50,
    });
    expect(listSubscribedZoneIdsMock).not.toHaveBeenCalled();
  });
});

describe("section data execution", () => {
  test("query sections compile through the boundary and hydrate items", async () => {
    const data = await service.getSectionData(
      "zone-1",
      "page-home",
      testNodeId(8),
      {
        preferredLanguages: ["zh-hant"],
      },
    );
    expect(searchSectionMock).toHaveBeenCalledTimes(1);
    const input = searchSectionMock.mock.calls[0]![0];
    expect(input.index).toBe("content");
    expect(input.filter).toContain('type = "BOOK"');
    expect(input.filter).toContain('realmIds = "realm-1"');
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

  test("query sections apply dynamic tag overrides without mutating config", async () => {
    await service.getSectionData("zone-1", "page-home", testNodeId(8), {
      dynamicTagUnitIds: ["tag-dynamic"],
    });

    const input = searchSectionMock.mock.calls[0]![0];
    expect(input.filter).toContain('tagIds = "tag-dynamic"');
    const columns = currentPage.config.sections[1] as Extract<
      ZonePageConfig["sections"][number],
      { kind: "columns" }
    >;
    const tabs = columns.columns[0]!.sections[1] as Extract<
      ZonePageConfig["sections"][number],
      { kind: "tabs" }
    >;
    const section = tabs.tabs[0]!.sections[0] as Extract<
      ZonePageConfig["sections"][number],
      { kind: "query" }
    >;
    expect(section.query.tagUnitIds).toBeUndefined();
  });

  test("query sections intersect with the zone boundary filter", async () => {
    const boundary = baseBoundary();
    boundary.filters = { types: ["SERIES"], ratings: ["GENERAL"] };
    currentZone = zoneRow({ boundary, page: currentPage.config });

    await service.getSectionData("zone-1", "page-home", testNodeId(8));
    const input = searchSectionMock.mock.calls[0]![0];
    expect(
      input.filter.some((clause: string) =>
        clause.includes("__zone_boundary_empty_intersection__"),
      ),
    ).toBe(true);
    expect(input.filter).toContain('rating = "GENERAL"');
  });

  test("realm query sections use the realms index and hydrate realm units", async () => {
    searchSectionMock.mockResolvedValueOnce({ ids: ["realm-2"], total: 1 });
    const page = basePage();
    page.sections.push({
      nodeId: testNodeId(14),
      slug: "realms",
      kind: "query",
      display: "tiles",
      limit: 12,
      query: {
        target: "realm",
        types: ["REALM"],
        sort: { field: "memberCount", direction: "desc" },
      },
    });
    currentPage = pageRow(page);
    currentZone = zoneRow({ page });

    const data = await service.getSectionData(
      "zone-1",
      "page-home",
      testNodeId(14),
    );
    const input = searchSectionMock.mock.calls[0]![0];
    expect(input.index).toBe("realms");
    expect(input.filter).toContain("isPublic = true");
    expect(input.sort).toEqual(["memberCount:desc"]);
    expect(data?.items).toEqual([
      expect.objectContaining({
        unitId: "realm-2",
        title: "Academy City",
      }),
    ]);
  });

  test("zone query sections use the zones index and hydrate zone units", async () => {
    searchSectionMock.mockResolvedValueOnce({ ids: ["zone-2"], total: 1 });
    const page = basePage();
    page.sections.push({
      nodeId: testNodeId(15),
      slug: "zones",
      kind: "query",
      display: "grid",
      limit: 12,
      query: {
        target: "zone",
        types: ["ZONE"],
        sort: { field: "updatedAt", direction: "desc" },
      },
    });
    currentPage = pageRow(page);
    currentZone = zoneRow({ page });

    const data = await service.getSectionData(
      "zone-1",
      "page-home",
      testNodeId(15),
    );
    const input = searchSectionMock.mock.calls[0]![0];
    expect(input.index).toBe("zones");
    expect(input.filter).toContain('visibility = "PUBLIC"');
    expect(input.sort).toEqual(["updatedAt:desc"]);
    expect(data?.items).toEqual([
      expect.objectContaining({
        unitId: "zone-2",
        type: "ZONE",
        title: "Featured Zone",
      }),
    ]);
  });

  test("stream query sections return renderable rows", async () => {
    const page = {
      schema: "rezics/page",
      version: 1,
      sections: [
        {
          nodeId: testNodeId(16),
          slug: "stream",
          kind: "query",
          display: "stream",
          query: {
            target: "unit",
            types: ["BOOK"],
            sort: { field: "hotScore", direction: "desc" },
          },
        },
      ],
    } satisfies ZonePageConfig;
    currentPage = pageRow(page);
    currentZone = zoneRow({ page });
    searchSectionMock.mockResolvedValueOnce({ ids: ["book-1"], total: 1 });
    bookListMock.mockResolvedValueOnce({
      books: [
        {
          unitId: "book-1",
          kind: "book",
          title: "A Certain Index",
          summary: "Magic and science.",
          coverUrl: "https://example.com/cover.jpg",
        },
      ],
      total: 1,
    });

    const data = await service.getSectionData(
      "zone-1",
      "page-home",
      testNodeId(16),
    );

    expect(data?.items).toEqual([]);
    expect(data?.rows?.[0]).toMatchObject({
      type: "book",
      rowId: "book:book-1",
      href: "/book/book-1",
      recommendationReason: "zone-stream-book",
      book: {
        unitId: "book-1",
        title: "A Certain Index",
        summary: "Magic and science.",
        coverUrl: "https://example.com/cover.jpg",
      },
    });
  });

  test("feed, collection, stats, and richText sections execute by page id", async () => {
    searchSectionMock.mockResolvedValueOnce({ ids: ["post-1"], total: 1 });
    const feed = await service.getSectionData(
      "zone-1",
      "page-home",
      testNodeId(10),
    );
    expect(searchSectionMock.mock.calls[0]![0].index).toBe("posts");
    expect(feed?.items).toEqual([]);
    expect(feed?.rows?.[0]).toMatchObject({
      type: "post",
      rowId: "post:post-1",
      post: { kind: "REMARK" },
    });

    const collection = await service.getSectionData(
      "zone-1",
      "page-home",
      testNodeId(12),
    );
    expect(collection?.items.map((item) => item.unitId)).toEqual(["book-1"]);

    const stats = await service.getSectionData(
      "zone-1",
      "page-home",
      testNodeId(11),
    );
    expect(stats?.stats).toEqual({ articles: 42, members: 7 });

    const richText = await service.getSectionData(
      "zone-1",
      "page-home",
      testNodeId(5),
      { preferredLanguages: ["zh-hant"] },
    );
    expect(richText?.docLanguage).toBe("zh-hant");
    expect((richText?.doc as any)?.main?.source).toBe("歡迎");
  });

  test("container and display sections expose no data endpoint", async () => {
    expect(
      service.getSectionData("zone-1", "page-home", testNodeId(6)),
    ).rejects.toThrow("Container sections have no section data");
    expect(
      service.getSectionData("zone-1", "page-home", testNodeId(1)),
    ).rejects.toThrow("Container sections have no section data");
    expect(
      service.getSectionData("zone-1", "page-home", testNodeId(3)),
    ).rejects.toThrow("Display sections have no section data");
  });
});

describe("portal ref units", () => {
  test("batches summaries for shell and page-referenced units", async () => {
    const refUnits = await service.getPortalRefUnits(
      currentZone!,
      currentPage,
      {
        preferredLanguages: ["en"],
      },
    );
    expect(refUnits["label-1"]).toEqual(
      expect.objectContaining({ unitId: "label-1", title: "Characters" }),
    );
    expect(refUnits["book-1"]).toEqual(
      expect.objectContaining({ unitId: "book-1", title: "A Certain Index" }),
    );
  });
});
