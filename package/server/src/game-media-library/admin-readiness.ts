import type {
  GameSystemRequirementListFilters,
  RatingTagSlug,
} from "@rezics/contract";
import { RATING_TAGS } from "@rezics/contract";
import { prisma } from "#/prisma/client";
import { gameSystemRequirementService } from "@/game-system-requirement/service";

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
  legacyPlatformRowCount: number;
  legacyPlatformRows: {
    gameUnitId: string;
    platformKey: string;
    sortOrder: number;
  }[];
  legacyAgeRatingRowCount: number;
  legacyAgeRatingRows: {
    gameUnitId: string;
    ageRatingKey: string;
  }[];
  searchProjectionMismatchCandidateUnitIds: string[];
};

function preferredLabel(translations: TranslationRow[]): string | null {
  return translations.find((translation) => translation.title)?.title ?? null;
}

export class GameMediaAdminReadinessService {
  async listPlatformEntities(): Promise<GameMediaAdminPlatform[]> {
    const rows = await prisma.entity.findMany({
      where: {
        kind: "game_platform",
        eligibleSubjectRoles: { has: "available_on" },
      },
      select: {
        unitId: true,
        unit: {
          select: {
            slug: true,
            translations: {
              select: { language: true, title: true },
              orderBy: [{ language: "asc" }],
            },
          },
        },
      },
      orderBy: { unitId: "asc" },
    });

    return rows.map((row) => ({
      entityUnitId: row.unitId,
      slug: row.unit.slug,
      label: preferredLabel(row.unit.translations),
      translations: row.unit.translations,
    }));
  }

  async listRatingTags(): Promise<GameMediaAdminRatingTag[]> {
    const rows = await prisma.unit.findMany({
      where: { type: "TAG", slug: { in: [...RATING_TAGS] } },
      select: {
        id: true,
        slug: true,
        translations: {
          select: { language: true, title: true },
          orderBy: [{ language: "asc" }],
        },
      },
    });
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
    const [platforms, ratingTags, legacyPlatformRows, legacyAgeRatingRows] =
      await Promise.all([
        this.listPlatformEntities(),
        this.listRatingTags(),
        prisma.gamePlatform.findMany({
          select: { gameUnitId: true, platformKey: true, sortOrder: true },
          orderBy: [{ gameUnitId: "asc" }, { sortOrder: "asc" }],
          take: 50,
        }),
        prisma.game.findMany({
          where: { ageRatingKey: { not: null } },
          select: { unitId: true, ageRatingKey: true },
          orderBy: { unitId: "asc" },
          take: 50,
        }),
      ]);

    const [legacyPlatformRowCount, legacyAgeRatingRowCount] = await Promise.all(
      [
        prisma.gamePlatform.count(),
        prisma.game.count({ where: { ageRatingKey: { not: null } } }),
      ],
    );

    const platformSlugs = new Set(platforms.map((platform) => platform.slug));
    const missingPlatformSlugs = EXPECTED_GAME_PLATFORM_SLUGS.filter(
      (slug) => !platformSlugs.has(slug),
    );
    const missingRatingTagSlugs = ratingTags
      .filter((tag) => tag.tagUnitId === null)
      .map((tag) => tag.slug);
    const searchProjectionMismatchCandidateUnitIds = [
      ...new Set([
        ...legacyPlatformRows.map((row) => row.gameUnitId),
        ...legacyAgeRatingRows.map((row) => row.unitId),
      ]),
    ].sort();

    return {
      missingPlatformSlugs,
      missingRatingTagSlugs,
      legacyPlatformRowCount,
      legacyPlatformRows,
      legacyAgeRatingRowCount,
      legacyAgeRatingRows: legacyAgeRatingRows.map((row) => ({
        gameUnitId: row.unitId,
        ageRatingKey: row.ageRatingKey ?? "",
      })),
      searchProjectionMismatchCandidateUnitIds,
    };
  }
}

export const gameMediaAdminReadinessService =
  new GameMediaAdminReadinessService();
