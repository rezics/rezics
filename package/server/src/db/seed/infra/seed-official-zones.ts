import {
  DEFAULT_LANGUAGE,
  markdownContentDoc,
  type ZoneBoundary,
  type ZoneBoundaryFilter,
  type ZoneNav,
  type ZonePage as ZonePageConfig,
  type ZonePageSection,
  type ZoneTheme,
} from "@rezics/contract";
import { and, eq } from "drizzle-orm";
import type { ServerDb } from "../../client";
import {
  Unit,
  UnitSupportLanguage,
  UnitTranslation,
  Zone,
  ZonePage,
} from "../../schema";
import type { SlugScopesMap } from "./seed-slug-scopes";

type OfficialZoneSeedDb = Pick<ServerDb, "insert" | "select" | "transaction">;

interface OfficialZoneTranslation {
  title: string;
  description: string;
}

type OfficialLabelTranslation = {
  title: string;
};

export interface OfficialZoneDefinition {
  key: "book" | "realms" | "zones" | "popular";
  slug: string;
  config: OfficialZoneConfig;
  translations: Record<string, OfficialZoneTranslation>;
}

export type OfficialZoneConfig = {
  boundary: ZoneBoundary;
  nav: ZoneNav;
  theme: ZoneTheme;
  pages: Array<{
    id: string;
    slug: string;
    position: number;
    config: ZonePageConfig;
  }>;
  homePageId: string;
};

const MAIN_MENU_ID = "main";

const OFFICIAL_PAGE_IDS = {
  book: {
    home: "00000000-0000-7000-8000-000000000101",
    search: "00000000-0000-7000-8000-000000000102",
    feed: "00000000-0000-7000-8000-000000000103",
  },
  realms: {
    home: "00000000-0000-7000-8000-000000000201",
    search: "00000000-0000-7000-8000-000000000202",
    feed: "00000000-0000-7000-8000-000000000203",
  },
  popular: {
    home: "00000000-0000-7000-8000-000000000301",
    search: "00000000-0000-7000-8000-000000000302",
    feed: "00000000-0000-7000-8000-000000000303",
  },
  zones: {
    home: "00000000-0000-7000-8000-000000000401",
    search: "00000000-0000-7000-8000-000000000402",
    feed: "00000000-0000-7000-8000-000000000403",
  },
} as const;

export const OFFICIAL_SECTION_LABELS = {
  bookLatest: {
    id: "00000000-0000-7000-8000-000000000501",
    translations: {
      en: { title: "Latest Books" },
      "zh-hant": { title: "最新書籍" },
      ja: { title: "新着書籍" },
    },
  },
  bookPopular: {
    id: "00000000-0000-7000-8000-000000000502",
    translations: {
      en: { title: "Popular Books" },
      "zh-hant": { title: "熱門書籍" },
      ja: { title: "人気の本" },
    },
  },
  bookReviews: {
    id: "00000000-0000-7000-8000-000000000503",
    translations: {
      en: { title: "Recent Reviews" },
      "zh-hant": { title: "最新書評" },
      ja: { title: "最新レビュー" },
    },
  },
  realmsLatest: {
    id: "00000000-0000-7000-8000-000000000504",
    translations: {
      en: { title: "New Realms" },
      "zh-hant": { title: "最新 Realm" },
      ja: { title: "新着 Realm" },
    },
  },
  realmsBrowse: {
    id: "00000000-0000-7000-8000-000000000505",
    translations: {
      en: { title: "Featured Realms" },
      "zh-hant": { title: "精選 Realm" },
      ja: { title: "注目の Realm" },
    },
  },
  realmsUpdates: {
    id: "00000000-0000-7000-8000-000000000506",
    translations: {
      en: { title: "Realm Updates" },
      "zh-hant": { title: "Realm 動態" },
      ja: { title: "Realm 更新" },
    },
  },
  zonesLatest: {
    id: "00000000-0000-7000-8000-000000000507",
    translations: {
      en: { title: "New Zones" },
      "zh-hant": { title: "最新專區" },
      ja: { title: "新着ゾーン" },
    },
  },
  zonesAll: {
    id: "00000000-0000-7000-8000-000000000508",
    translations: {
      en: { title: "All Zones" },
      "zh-hant": { title: "所有專區" },
      ja: { title: "すべてのゾーン" },
    },
  },
  popularNow: {
    id: "00000000-0000-7000-8000-000000000509",
    translations: {
      en: { title: "Popular Now" },
      "zh-hant": { title: "此刻熱門" },
      ja: { title: "いま人気" },
    },
  },
  popularLatest: {
    id: "00000000-0000-7000-8000-000000000510",
    translations: {
      en: { title: "Latest Content" },
      "zh-hant": { title: "最新內容" },
      ja: { title: "最新コンテンツ" },
    },
  },
  popularFeed: {
    id: "00000000-0000-7000-8000-000000000511",
    translations: {
      en: { title: "Community Activity" },
      "zh-hant": { title: "社群動態" },
      ja: { title: "コミュニティ活動" },
    },
  },
} satisfies Record<
  string,
  {
    id: string;
    translations: Record<string, OfficialLabelTranslation>;
  }
>;

/**
 * Seeds bypass the zone service write path, so every shell/page envelope
 * written here must already satisfy its contract schema: the read path throws
 * on rows that fail envelope parsing.
 * 种子绕过 zone service 的写入路径，因此这里写入的每个 shell/page 信封
 * 都必须已经满足对应契约 schema：读取路径会对未通过信封解析的行抛错。
 */
function officialConfig(input: {
  filters: ZoneBoundaryFilter;
  homeSections: ZonePageSection[];
  accent: string;
  density: "compact" | "comfortable";
  pageIds: { home: string; search: string; feed: string };
}): OfficialZoneConfig {
  const pageIds = input.pageIds;
  return {
    boundary: {
      schema: "rezics/zone-boundary",
      version: 1,
      // Official zones are owned by the rezics realm but aggregate the whole
      // platform, so their interaction context stays global.
      context: { kind: "global" },
      filters: input.filters,
    },
    nav: {
      schema: "rezics/zone-nav",
      version: 1,
      menus: [
        {
          id: MAIN_MENU_ID,
          // Leaf nodes need only a target; zonePage labels resolve through
          // the frontend's default i18n keys.
          nodes: [
            { id: "home", target: { kind: "zonePage", pageId: pageIds.home } },
            {
              id: "search",
              target: { kind: "zonePage", pageId: pageIds.search },
            },
            { id: "feed", target: { kind: "zonePage", pageId: pageIds.feed } },
          ],
        },
      ],
      header: { menuId: MAIN_MENU_ID },
    },
    pages: [
      {
        id: pageIds.home,
        slug: "home",
        position: 0,
        config: {
          schema: "rezics/zone-page",
          version: 1,
          sections: input.homeSections,
        },
      },
      {
        id: pageIds.search,
        slug: "search",
        position: 1,
        config: { schema: "rezics/zone-page", version: 1, sections: [] },
      },
      {
        id: pageIds.feed,
        slug: "feed",
        position: 2,
        config: {
          schema: "rezics/zone-page",
          version: 1,
          sections: [{ id: "feed", kind: "feed", feedKind: "all", limit: 20 }],
        },
      },
    ],
    homePageId: pageIds.home,
    theme: {
      schema: "rezics/zone-theme",
      version: 1,
      tokens: { accent: input.accent, accentText: "#ffffff" },
      layout: { contentMaxWidth: 1440, density: input.density },
    },
  };
}

const bookConfig = officialConfig({
  pageIds: OFFICIAL_PAGE_IDS.book,
  filters: { types: ["BOOK"] },
  homeSections: [
    { id: "hero", kind: "hero", showDescription: true },
    {
      id: "latest-books",
      kind: "query",
      titleLabelUnitId: OFFICIAL_SECTION_LABELS.bookLatest.id,
      display: "covers",
      limit: 24,
      loadMore: true,
      query: {
        target: "unit",
        types: ["BOOK"],
        sort: { field: "publishedAt", direction: "desc" },
      },
    },
    {
      id: "popular-books",
      kind: "query",
      titleLabelUnitId: OFFICIAL_SECTION_LABELS.bookPopular.id,
      display: "grid",
      limit: 24,
      loadMore: true,
      query: {
        target: "unit",
        types: ["BOOK"],
        sort: { field: "qualityScore", direction: "desc" },
      },
    },
    {
      id: "book-reviews",
      kind: "query",
      titleLabelUnitId: OFFICIAL_SECTION_LABELS.bookReviews.id,
      display: "list",
      limit: 20,
      loadMore: true,
      query: {
        target: "post",
        postKinds: ["REVIEW"],
        sort: { field: "createdAt", direction: "desc" },
      },
    },
  ],
  accent: "#2563eb",
  density: "comfortable",
});

const realmsConfig = officialConfig({
  pageIds: OFFICIAL_PAGE_IDS.realms,
  filters: { types: ["REALM"] },
  homeSections: [
    { id: "hero", kind: "hero", showDescription: true },
    {
      id: "latest-realms",
      kind: "query",
      titleLabelUnitId: OFFICIAL_SECTION_LABELS.realmsLatest.id,
      display: "carousel",
      limit: 24,
      loadMore: true,
      query: {
        target: "realm",
        types: ["REALM"],
        sort: { field: "createdAt", direction: "desc" },
      },
    },
    {
      id: "browse-realms",
      kind: "query",
      titleLabelUnitId: OFFICIAL_SECTION_LABELS.realmsBrowse.id,
      display: "tiles",
      limit: 24,
      loadMore: true,
      query: {
        target: "realm",
        types: ["REALM"],
        sort: { field: "memberCount", direction: "desc" },
      },
    },
    {
      id: "realm-updates",
      kind: "query",
      titleLabelUnitId: OFFICIAL_SECTION_LABELS.realmsUpdates.id,
      display: "list",
      limit: 20,
      loadMore: true,
      query: {
        target: "realm",
        types: ["REALM"],
        sort: { field: "updatedAt", direction: "desc" },
      },
    },
  ],
  accent: "#0f766e",
  density: "compact",
});

const zonesConfig = officialConfig({
  pageIds: OFFICIAL_PAGE_IDS.zones,
  filters: { types: ["ZONE"] },
  homeSections: [
    { id: "hero", kind: "hero", showDescription: true },
    {
      id: "latest-zones",
      kind: "query",
      titleLabelUnitId: OFFICIAL_SECTION_LABELS.zonesLatest.id,
      display: "carousel",
      limit: 24,
      loadMore: true,
      query: {
        target: "zone",
        types: ["ZONE"],
        sort: { field: "createdAt", direction: "desc" },
      },
    },
    {
      id: "all-zones",
      kind: "query",
      titleLabelUnitId: OFFICIAL_SECTION_LABELS.zonesAll.id,
      display: "grid",
      limit: 24,
      loadMore: true,
      query: {
        target: "zone",
        types: ["ZONE"],
        sort: { field: "updatedAt", direction: "desc" },
      },
    },
  ],
  accent: "#7c3aed",
  density: "comfortable",
});

const popularConfig = officialConfig({
  pageIds: OFFICIAL_PAGE_IDS.popular,
  filters: {},
  homeSections: [
    { id: "hero", kind: "hero", showDescription: true },
    {
      id: "popular-now",
      kind: "query",
      titleLabelUnitId: OFFICIAL_SECTION_LABELS.popularNow.id,
      display: "grid",
      limit: 30,
      loadMore: true,
      query: {
        target: "unit",
        sort: { field: "trendingScore", direction: "desc" },
      },
    },
    {
      id: "latest-content",
      kind: "query",
      titleLabelUnitId: OFFICIAL_SECTION_LABELS.popularLatest.id,
      display: "list",
      limit: 30,
      loadMore: true,
      query: {
        target: "unit",
        sort: { field: "publishedAt", direction: "desc" },
      },
    },
    {
      id: "popular-feed",
      kind: "feed",
      titleLabelUnitId: OFFICIAL_SECTION_LABELS.popularFeed.id,
      feedKind: "all",
      limit: 20,
    },
  ],
  accent: "#c2410c",
  density: "comfortable",
});

/**
 * Official zones are either type libraries, one per major UnitType, or
 * cross-cutting views. Libraries lead with browsable catalog sections and
 * activity; trending-led discovery belongs to `popular`. ZONE units usually
 * have sparse score signals early, so the zones library leads with recency
 * and update sorts rather than qualityScore.
 */
export const OFFICIAL_ZONE_DEFINITIONS: OfficialZoneDefinition[] = [
  {
    key: "book",
    slug: "book",
    config: bookConfig,
    translations: {
      en: {
        title: "Books",
        description: "The Rezics book library and reading community.",
      },
      "zh-hant": {
        title: "書籍",
        description: "Rezics 的書籍資料庫與閱讀社群。",
      },
      ja: {
        title: "本",
        description: "Rezics の本ライブラリと読書コミュニティ。",
      },
    },
  },
  {
    key: "realms",
    slug: "realms",
    config: realmsConfig,
    translations: {
      en: {
        title: "Realms",
        description:
          "The Rezics realms library: communities that classify and discuss works.",
      },
      "zh-hant": {
        title: "Realms",
        description: "Rezics 的 Realms 社群資料庫：共同分類與討論作品的地方。",
      },
      ja: {
        title: "Realms",
        description:
          "Rezics の Realms ライブラリ。作品を分類し語り合うコミュニティ。",
      },
    },
  },
  {
    key: "zones",
    slug: "zones",
    config: zonesConfig,
    translations: {
      en: {
        title: "Zones",
        description: "The Rezics zones library: curated portals across units.",
      },
      "zh-hant": {
        title: "專區",
        description: "Rezics 的專區資料庫：跨 Unit 的整理入口。",
      },
      ja: {
        title: "ゾーン",
        description:
          "Rezics のゾーンライブラリ。ユニットを横断する整理ポータル。",
      },
    },
  },
  {
    key: "popular",
    slug: "popular",
    config: popularConfig,
    translations: {
      en: {
        title: "Popular",
        description: "Trending works, posts, reviews, and community activity.",
      },
      "zh-hant": {
        title: "熱門",
        description: "熱門作品、貼文、書評與社群活動。",
      },
      ja: {
        title: "人気",
        description: "話題の作品、投稿、レビュー、コミュニティ活動。",
      },
    },
  },
];

async function upsertZoneRow(
  db: OfficialZoneSeedDb,
  input: {
    unitId: string;
    ownerRealmUnitId: string;
    definition: OfficialZoneDefinition;
  },
) {
  const { definition } = input;
  await db
    .insert(Zone)
    .values({
      unitId: input.unitId,
      ownerRealmUnitId: input.ownerRealmUnitId,
      boundary: definition.config.boundary,
      nav: definition.config.nav,
      theme: definition.config.theme,
      homePageId: definition.config.homePageId,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: Zone.unitId,
      set: {
        ownerRealmUnitId: input.ownerRealmUnitId,
        boundary: definition.config.boundary,
        nav: definition.config.nav,
        theme: definition.config.theme,
        homePageId: definition.config.homePageId,
        updatedAt: new Date(),
      },
    });
  for (const page of definition.config.pages) {
    await db
      .insert(ZonePage)
      .values({
        id: page.id,
        zoneUnitId: input.unitId,
        slug: page.slug,
        position: page.position,
        config: page.config,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [ZonePage.zoneUnitId, ZonePage.slug],
        set: {
          slug: page.slug,
          position: page.position,
          config: page.config,
          updatedAt: new Date(),
        },
      });
  }
}

async function upsertTranslations(
  db: OfficialZoneSeedDb,
  unitId: string,
  definition: OfficialZoneDefinition,
) {
  const languages = Object.keys(definition.translations);
  for (const [index, language] of languages.entries()) {
    const translation = definition.translations[language]!;
    await db
      .insert(UnitTranslation)
      .values({
        unitId,
        language,
        title: translation.title,
        description: markdownContentDoc(translation.description),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [UnitTranslation.unitId, UnitTranslation.language],
        set: {
          title: translation.title,
          description: markdownContentDoc(translation.description),
          updatedAt: new Date(),
        },
      });
    await db
      .insert(UnitSupportLanguage)
      .values({
        unitId,
        language,
        isPrimary: language === DEFAULT_LANGUAGE,
        sortOrder: index,
      })
      .onConflictDoUpdate({
        target: [UnitSupportLanguage.unitId, UnitSupportLanguage.language],
        set: {
          isPrimary: language === DEFAULT_LANGUAGE,
          sortOrder: index,
        },
      });
  }
}

async function upsertOfficialSectionLabels(
  db: OfficialZoneSeedDb,
  slugScopes: SlugScopesMap,
) {
  for (const label of Object.values(OFFICIAL_SECTION_LABELS)) {
    const languages = Object.keys(label.translations);
    await db
      .insert(Unit)
      .values({
        id: label.id,
        type: "LABEL",
        slug: null,
        slugScope: slugScopes.zone,
        status: "PUBLISHED",
        visibility: "PUBLIC",
        defaultLanguage: DEFAULT_LANGUAGE,
        isLanguageNeutral: true,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: Unit.id,
        set: {
          type: "LABEL",
          slug: null,
          slugScope: slugScopes.zone,
          status: "PUBLISHED",
          visibility: "PUBLIC",
          defaultLanguage: DEFAULT_LANGUAGE,
          isLanguageNeutral: true,
          updatedAt: new Date(),
        },
      });
    for (const [index, language] of languages.entries()) {
      const translation = label.translations[language]!;
      await db
        .insert(UnitTranslation)
        .values({
          unitId: label.id,
          language,
          title: translation.title,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [UnitTranslation.unitId, UnitTranslation.language],
          set: {
            title: translation.title,
            updatedAt: new Date(),
          },
        });
      await db
        .insert(UnitSupportLanguage)
        .values({
          unitId: label.id,
          language,
          isPrimary: language === DEFAULT_LANGUAGE,
          sortOrder: index,
        })
        .onConflictDoUpdate({
          target: [UnitSupportLanguage.unitId, UnitSupportLanguage.language],
          set: {
            isPrimary: language === DEFAULT_LANGUAGE,
            sortOrder: index,
          },
        });
    }
  }
}

async function createOfficialZone(
  db: OfficialZoneSeedDb,
  input: {
    ownerRealmUnitId: string;
    slugScopes: SlugScopesMap;
    definition: OfficialZoneDefinition;
  },
): Promise<string> {
  return db.transaction(async (tx) => {
    const [unit] = await tx
      .insert(Unit)
      .values({
        type: "ZONE",
        slug: input.definition.slug,
        slugScope: input.slugScopes.zone,
        status: "PUBLISHED",
        visibility: "PUBLIC",
        defaultLanguage: DEFAULT_LANGUAGE,
        publishedAt: new Date(),
        updatedAt: new Date(),
      })
      .returning({ id: Unit.id });
    if (!unit) {
      throw new Error(
        `Failed to create official zone Unit "${input.definition.slug}"`,
      );
    }

    await upsertZoneRow(tx as OfficialZoneSeedDb, {
      unitId: unit.id,
      ownerRealmUnitId: input.ownerRealmUnitId,
      definition: input.definition,
    });
    await upsertTranslations(
      tx as OfficialZoneSeedDb,
      unit.id,
      input.definition,
    );
    return unit.id;
  });
}

/**
 * Seed platform-owned portal zones as ordinary ZONE Units owned by the Rezics
 * official realm. They are intentionally not special routes or ACL islands:
 * sidebar defaults, unsubscribe, and recovery all treat these ids like normal
 * subscriptions.
 */
export async function seedOfficialZones(
  db: OfficialZoneSeedDb,
  ownerRealmUnitId: string,
  slugScopes: SlugScopesMap,
): Promise<Record<OfficialZoneDefinition["key"], string>> {
  console.log("[Seed] Seeding official zones...");
  await upsertOfficialSectionLabels(db, slugScopes);
  const result = {} as Record<OfficialZoneDefinition["key"], string>;

  for (const definition of OFFICIAL_ZONE_DEFINITIONS) {
    const [existing] = await db
      .select({ id: Unit.id, type: Unit.type })
      .from(Unit)
      .where(
        and(
          eq(Unit.slugScope, slugScopes.zone),
          eq(Unit.slug, definition.slug),
        ),
      )
      .limit(1);

    if (existing) {
      if (existing.type !== "ZONE") {
        throw new Error(
          `[Seed] Slug "${definition.slug}" under zone scope is already used by a non-ZONE unit (type=${existing.type}).`,
        );
      }
      await upsertZoneRow(db, {
        unitId: existing.id,
        ownerRealmUnitId,
        definition,
      });
      await upsertTranslations(db, existing.id, definition);
      result[definition.key] = existing.id;
      console.log(
        `[Seed]   Official zone "${definition.slug}" already exists (${existing.id}), updated config.`,
      );
      continue;
    }

    result[definition.key] = await createOfficialZone(db, {
      ownerRealmUnitId,
      slugScopes,
      definition,
    });
    console.log(
      `[Seed]   Created official zone "${definition.slug}" (${result[definition.key]})`,
    );
  }

  return result;
}
