import type {
  GameSystemRequirementListFilters,
  RatingTagSlug,
} from "@rezics/contract";
import { RATING_TAGS } from "@rezics/contract";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { Entity, Unit, UnitTranslation } from "../db/schema";
import { gameSystemRequirementService } from "../game-system-requirement/service";

export const EXPECTED_GAME_PLATFORM_SLUGS = [
  "windows",
  "macos",
  "linux",
  "steam",
  "steam-deck",
  "playstation",
  "xbox",
  "nintendo-switch",
  "ios",
  "android",
  "web",
] as const;

type TranslationRow = {
  language: string;
  title: string | null;
};

export type GameMediaAdminPlatform = {
  entityUnitId: string;
  slug: string | null;
  label: string | null;
  translations: TranslationRow[];
};

export type GameMediaAdminRatingTag = {
  slug: RatingTagSlug;
  tagUnitId: string | null;
  label: string | null;
  translations: TranslationRow[];
};

export type GameMediaAdminDiagnostics = {
  missingPlatformSlugs: string[];
  missingRatingTagSlugs: RatingTagSlug[];
};

export interface GameMediaAdminReadinessRepository {
  listPlatformEntities(): Promise<GameMediaAdminPlatform[]>;
  listRatingTags(): Promise<
    Array<{
      id: string;
      slug: string | null;
      translations: TranslationRow[];
    }>
  >;
}

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

async function loadTranslations(
  unitIds: readonly string[],
): Promise<Map<string, TranslationRow[]>> {
  if (unitIds.length === 0) return new Map();
  const db = await getServerDb();
  const rows = await db
    .select({
      unitId: UnitTranslation.unitId,
      language: UnitTranslation.language,
      title: UnitTranslation.title,
    })
    .from(UnitTranslation)
    .where(inArray(UnitTranslation.unitId, [...unitIds]))
    .orderBy(asc(UnitTranslation.language));
  const byUnitId = new Map<string, TranslationRow[]>();
  for (const row of rows) {
    const translations = byUnitId.get(row.unitId) ?? [];
    translations.push({ language: row.language, title: row.title });
    byUnitId.set(row.unitId, translations);
  }
  return byUnitId;
}

function createDrizzleGameMediaAdminReadinessRepository(): GameMediaAdminReadinessRepository {
  return {
    async listPlatformEntities() {
      const db = await getServerDb();
      const rows = await db
        .select({
          unitId: Entity.unitId,
          slug: Unit.slug,
        })
        .from(Entity)
        .innerJoin(Unit, eq(Unit.id, Entity.unitId))
        .where(
          and(
            eq(Entity.kind, "game_platform"),
            sql`${Entity.eligibleSubjectRoles} @> ARRAY['available_on']::text[]`,
          ),
        )
        .orderBy(asc(Entity.unitId));
      const translations = await loadTranslations(
        rows.map((row) => row.unitId),
      );
      return rows.map((row) => {
        const unitTranslations = translations.get(row.unitId) ?? [];
        return {
          entityUnitId: row.unitId,
          slug: row.slug,
          label: preferredLabel(unitTranslations),
          translations: unitTranslations,
        };
      });
    },

    async listRatingTags() {
      const db = await getServerDb();
      const rows = await db
        .select({ id: Unit.id, slug: Unit.slug })
        .from(Unit)
        .where(and(eq(Unit.type, "TAG"), inArray(Unit.slug, [...RATING_TAGS])));
      const translations = await loadTranslations(rows.map((row) => row.id));
      return rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        translations: translations.get(row.id) ?? [],
      }));
    },
  };
}

const defaultRepository = createDrizzleGameMediaAdminReadinessRepository();

function preferredLabel(translations: TranslationRow[]): string | null {
  return translations.find((translation) => translation.title)?.title ?? null;
}

export class GameMediaAdminReadinessService {
  constructor(
    public repository: GameMediaAdminReadinessRepository = defaultRepository,
  ) {}

  async listPlatformEntities(): Promise<GameMediaAdminPlatform[]> {
    return this.repository.listPlatformEntities();
  }

  async listRatingTags(): Promise<GameMediaAdminRatingTag[]> {
    const rows = await this.repository.listRatingTags();
    const bySlug = new Map(rows.map((row) => [row.slug, row]));

    return RATING_TAGS.map((slug) => {
      const row = bySlug.get(slug);
      return {
        slug,
        tagUnitId: row?.id ?? null,
        label: row ? preferredLabel(row.translations) : null,
        translations: row?.translations ?? [],
      };
    });
  }

  listSystemRequirements(filters?: GameSystemRequirementListFilters) {
    return gameSystemRequirementService.list(filters);
  }

  async diagnostics(): Promise<GameMediaAdminDiagnostics> {
    const [platforms, ratingTags] = await Promise.all([
      this.listPlatformEntities(),
      this.listRatingTags(),
    ]);

    const platformSlugs = new Set(platforms.map((platform) => platform.slug));
    const missingPlatformSlugs = EXPECTED_GAME_PLATFORM_SLUGS.filter(
      (slug) => !platformSlugs.has(slug),
    );
    const missingRatingTagSlugs = ratingTags
      .filter((tag) => tag.tagUnitId === null)
      .map((tag) => tag.slug);

    return {
      missingPlatformSlugs,
      missingRatingTagSlugs,
    };
  }
}

export const gameMediaAdminReadinessService =
  new GameMediaAdminReadinessService();
