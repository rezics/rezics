import {
  DEFAULT_LANGUAGE,
  markdownContentDoc,
  ZONE_CONFIG_SCHEMA,
  ZONE_CONFIG_V1_VERSION,
  type ZoneBoundaryFilter,
  type ZoneConfigV1,
  type ZonePageSection,
} from "@rezics/contract";
import { and, eq } from "drizzle-orm";
import type { ServerDb } from "../../client";
import { Unit, UnitSupportLanguage, UnitTranslation, Zone } from "../../schema";
import type { SlugScopesMap } from "./seed-slug-scopes";

type OfficialZoneSeedDb = Pick<ServerDb, "insert" | "select" | "transaction">;

interface OfficialZoneTranslation {
  title: string;
  description: string;
}

export interface OfficialZoneDefinition {
  key: "book" | "realms" | "popular";
  slug: string;
  config: ZoneConfigV1;
  translations: Record<string, OfficialZoneTranslation>;
}

const MAIN_MENU_ID = "main";

/**
 * Seeds bypass the zone service write path, so every config written here
 * must already satisfy `zoneConfigV1Schema`: the read path
 * (`parseZoneRowConfig`) throws on rows that fail the envelope union.
 * 种子绕过 zone service 的写入路径，因此这里写入的每个配置都必须已经
 * 满足 `zoneConfigV1Schema`：读取路径（`parseZoneRowConfig`）会对未通过
 * 信封联合校验的行抛错。
 */
function officialConfig(input: {
  filters: ZoneBoundaryFilter;
  homeSections: ZonePageSection[];
  accent: string;
  density: "compact" | "comfortable";
}): ZoneConfigV1 {
  return {
    schema: ZONE_CONFIG_SCHEMA,
    version: ZONE_CONFIG_V1_VERSION,
    // Official zones are owned by the rezics realm but aggregate the whole
    // platform, so their interaction context stays global.
    // 官方专区由 rezics realm 拥有，但聚合全平台内容，因此其交互语境
    // 保持 global。
    context: { kind: "global" },
    filters: input.filters,
    menus: [
      {
        id: MAIN_MENU_ID,
        // Leaf nodes need only a target; zonePage labels resolve through
        // the frontend's default i18n keys.
        // 叶子节点只需要 target；zonePage 标签通过前端默认 i18n key 解析。
        nodes: [
          { id: "home", target: { kind: "zonePage", pageId: "home" } },
          { id: "search", target: { kind: "zonePage", pageId: "search" } },
          { id: "feed", target: { kind: "zonePage", pageId: "feed" } },
        ],
      },
    ],
    header: { menuId: MAIN_MENU_ID },
    pages: {
      home: { sections: input.homeSections },
      search: { sections: [] },
      feed: {
        sections: [{ id: "feed", kind: "feed", feedKind: "all", limit: 20 }],
      },
    },
    theme: {
      tokens: { accent: input.accent, accentText: "#ffffff" },
      layout: { contentWidth: "wide", density: input.density },
    },
  };
}

const bookConfig = officialConfig({
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
      config: definition.config,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: Zone.unitId,
      set: {
        ownerRealmUnitId: input.ownerRealmUnitId,
        config: definition.config,
        updatedAt: new Date(),
      },
    });
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
