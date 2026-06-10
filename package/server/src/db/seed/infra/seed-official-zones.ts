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

export interface OfficialZoneDefinition {
  key: "book" | "realms" | "popular";
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
} as const;

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
      layout: { contentWidth: "wide", density: input.density },
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
      id: "featured-realms",
      kind: "query",
      display: "tiles",
      limit: 24,
      loadMore: true,
      query: {
        target: "unit",
        types: ["REALM"],
        sort: { field: "qualityScore", direction: "desc" },
      },
    },
    {
      id: "active-realms",
      kind: "query",
      display: "list",
      limit: 24,
      loadMore: true,
      query: {
        target: "unit",
        types: ["REALM"],
        sort: { field: "trendingScore", direction: "desc" },
      },
    },
    { id: "realm-updates", kind: "feed", feedKind: "updates", limit: 20 },
  ],
  accent: "#0f766e",
  density: "compact",
});

const popularConfig = officialConfig({
  pageIds: OFFICIAL_PAGE_IDS.popular,
  filters: {},
  homeSections: [
    { id: "hero", kind: "hero", showDescription: true },
    {
      id: "popular-now",
      kind: "query",
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
      display: "list",
      limit: 30,
      loadMore: true,
      query: {
        target: "unit",
        sort: { field: "publishedAt", direction: "desc" },
      },
    },
    { id: "popular-feed", kind: "feed", feedKind: "all", limit: 20 },
  ],
  accent: "#c2410c",
  density: "comfortable",
});

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
        description: "Discover communities that classify and discuss works.",
      },
      "zh-hant": {
        title: "Realms",
        description: "探索共同分類與討論作品的社群。",
      },
      ja: {
        title: "Realms",
        description: "作品を分類し語り合うコミュニティを見つける。",
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
