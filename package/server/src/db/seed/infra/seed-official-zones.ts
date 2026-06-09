import {
  DEFAULT_LANGUAGE,
  markdownContentDoc,
  type ZoneFilters,
  type ZonePages,
  type ZoneSection,
  type ZoneTheme,
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
  template: "book" | "default";
  filters: ZoneFilters;
  sections: ZoneSection[];
  pages: ZonePages;
  theme: ZoneTheme;
  translations: Record<string, OfficialZoneTranslation>;
}

const label = (en: string, zhHant: string, ja: string) => ({
  translations: { en, "zh-hant": zhHant, ja },
  fallbackLanguage: DEFAULT_LANGUAGE,
});

const feedSection = (id: string, titleEn: string): ZoneSection => ({
  id,
  kind: "feed",
  feedKind: "all",
  title: label(titleEn, titleEn, titleEn),
  limit: 20,
});

const bookSections: ZoneSection[] = [
  {
    id: "latest-books",
    kind: "latestContent",
    source: "unit",
    title: label("Latest Books", "最新書籍", "新着書籍"),
    filters: { type: "BOOK" },
    limit: 24,
  },
  {
    id: "popular-books",
    kind: "popularContent",
    metric: "rating",
    title: label("Popular Books", "熱門書籍", "人気の本"),
    filters: { type: "BOOK" },
    limit: 24,
  },
  {
    id: "book-reviews",
    kind: "reviewStream",
    title: label("Book Reviews", "書評", "ブックレビュー"),
    filters: { type: "BOOK" },
    limit: 20,
  },
];

const realmSections: ZoneSection[] = [
  {
    id: "official-realms",
    kind: "realmList",
    title: label("Featured Realms", "精選 Realm", "注目の Realm"),
    limit: 24,
  },
  {
    id: "active-realms",
    kind: "popularContent",
    metric: "discussion",
    title: label("Active Realms", "活躍 Realm", "活発な Realm"),
    filters: { type: "REALM" },
    limit: 24,
  },
  feedSection("realm-updates", "Realm Updates"),
];

const popularSections: ZoneSection[] = [
  {
    id: "popular-now",
    kind: "popularContent",
    metric: "discussion",
    title: label("Popular Now", "當下熱門", "今話題"),
    limit: 30,
  },
  {
    id: "latest-content",
    kind: "latestContent",
    source: "unit",
    title: label("Latest Content", "最新內容", "新着コンテンツ"),
    limit: 30,
  },
  feedSection("popular-feed", "Popular Feed"),
];

function pages(
  title: OfficialZoneDefinition["translations"],
  sections: ZoneSection[],
): ZonePages {
  return {
    home: {
      title: {
        translations: Object.fromEntries(
          Object.entries(title).map(([language, value]) => [
            language,
            value.title,
          ]),
        ),
        fallbackLanguage: DEFAULT_LANGUAGE,
      },
      sections,
    },
    search: {
      title: label("Search", "搜尋", "検索"),
      sections: [],
    },
    feed: {
      title: label("Feed", "動態", "フィード"),
      sections: [feedSection("feed", "Feed")],
    },
  };
}

export const OFFICIAL_ZONE_DEFINITIONS: OfficialZoneDefinition[] = [
  {
    key: "book",
    slug: "book",
    template: "book",
    filters: { type: "BOOK" },
    sections: bookSections,
    pages: pages(
      {
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
      bookSections,
    ),
    theme: {
      tokens: { accent: "#2563eb", accentText: "#ffffff" },
      layout: {
        contentWidth: "wide",
        navPosition: "top",
        density: "comfortable",
      },
    },
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
    template: "default",
    filters: { type: "REALM" },
    sections: realmSections,
    pages: pages(
      {
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
      realmSections,
    ),
    theme: {
      tokens: { accent: "#0f766e", accentText: "#ffffff" },
      layout: { contentWidth: "wide", navPosition: "top", density: "compact" },
    },
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
    template: "default",
    filters: {},
    sections: popularSections,
    pages: pages(
      {
        en: {
          title: "Popular",
          description:
            "Trending works, posts, reviews, and community activity.",
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
      popularSections,
    ),
    theme: {
      tokens: { accent: "#c2410c", accentText: "#ffffff" },
      layout: {
        contentWidth: "wide",
        navPosition: "top",
        density: "comfortable",
      },
    },
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
      filters: definition.filters,
      configVersion: 1,
      pages: definition.pages,
      sections: definition.sections,
      theme: definition.theme,
      template: definition.template,
      styling: null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: Zone.unitId,
      set: {
        ownerRealmUnitId: input.ownerRealmUnitId,
        filters: definition.filters,
        configVersion: 1,
        pages: definition.pages,
        sections: definition.sections,
        theme: definition.theme,
        template: definition.template,
        styling: null,
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
