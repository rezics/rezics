import {
  DEFAULT_LANGUAGE,
  FALLBACK_LANGUAGE,
  RATING_TAGS,
  type RatingTagSlug,
} from "@rezics/contract";
import type { PrismaClient } from "#/prisma/generated/client";
import type { SlugScopesMap } from "./seed-slug-scopes";

const GAME_PLATFORMS = [
  { slug: "windows", title: "Windows" },
  { slug: "macos", title: "macOS" },
  { slug: "linux", title: "Linux" },
  { slug: "steam", title: "Steam" },
  { slug: "steam-deck", title: "Steam Deck" },
  { slug: "playstation", title: "PlayStation" },
  { slug: "xbox", title: "Xbox" },
  { slug: "nintendo-switch", title: "Nintendo Switch" },
  { slug: "ios", title: "iOS" },
  { slug: "android", title: "Android" },
  { slug: "web", title: "Web" },
] as const;

type PlatformSlug = (typeof GAME_PLATFORMS)[number]["slug"];

const RATING_TAG_TITLES = {
  "esrb-everyone": "ESRB Everyone",
  "esrb-everyone-10": "ESRB Everyone 10+",
  "esrb-teen": "ESRB Teen",
  "esrb-mature": "ESRB Mature 17+",
  "esrb-adults-only": "ESRB Adults Only 18+",
  "pegi-3": "PEGI 3",
  "pegi-7": "PEGI 7",
  "pegi-12": "PEGI 12",
  "pegi-16": "PEGI 16",
  "pegi-18": "PEGI 18",
  "cero-a": "CERO A",
  "cero-b": "CERO B",
  "cero-c": "CERO C",
  "cero-d": "CERO D",
  "cero-z": "CERO Z",
  "mpaa-g": "MPAA G",
  "mpaa-pg": "MPAA PG",
  "mpaa-pg-13": "MPAA PG-13",
  "mpaa-r": "MPAA R",
  "mpaa-nc-17": "MPAA NC-17",
  "tv-y": "TV-Y",
  "tv-y7": "TV-Y7",
  "tv-g": "TV-G",
  "tv-pg": "TV-PG",
  "tv-14": "TV-14",
  "tv-ma": "TV-MA",
} as const satisfies Record<RatingTagSlug, string>;

async function syncUnitTranslations(
  prisma: PrismaClient,
  unitId: string,
  title: string,
): Promise<void> {
  await Promise.all(
    [DEFAULT_LANGUAGE, FALLBACK_LANGUAGE].map((language, sortOrder) =>
      Promise.all([
        prisma.unitTranslation.upsert({
          where: { unitId_language: { unitId, language } },
          update: { title },
          create: { unitId, language, title },
        }),
        prisma.unitSupportLanguage.upsert({
          where: { unitId_language: { unitId, language } },
          update: {
            isPrimary: language === DEFAULT_LANGUAGE,
            sortOrder,
          },
          create: {
            unitId,
            language,
            isPrimary: language === DEFAULT_LANGUAGE,
            sortOrder,
          },
        }),
      ]),
    ),
  );
}

async function ensurePlatformEntity(
  prisma: PrismaClient,
  entityScope: string,
  slug: string,
  title: string,
): Promise<string> {
  const existing = await prisma.unit.findUnique({
    where: { slugScope_slug: { slugScope: entityScope, slug } },
    select: { id: true, type: true },
  });

  if (existing) {
    if (existing.type !== "ENTITY") {
      throw new Error(
        `[Seed] Slug "${slug}" under entity scope is already used by a non-ENTITY unit (type=${existing.type}).`,
      );
    }

    await prisma.entity.upsert({
      where: { unitId: existing.id },
      update: {
        kind: "game_platform",
        verified: true,
        eligibleSubjectRoles: ["available_on"],
      },
      create: {
        unitId: existing.id,
        kind: "game_platform",
        verified: true,
        eligibleSubjectRoles: ["available_on"],
        eligibleCreditRoles: [],
      },
    });
    await syncUnitTranslations(prisma, existing.id, title);
    return existing.id;
  }

  const unit = await prisma.unit.create({
    data: {
      type: "ENTITY",
      slug,
      slugScope: entityScope,
      status: "PUBLISHED",
      visibility: "PUBLIC",
      isLanguageNeutral: true,
      defaultLanguage: DEFAULT_LANGUAGE,
      publishedAt: new Date(),
      entity: {
        create: {
          kind: "game_platform",
          verified: true,
          eligibleSubjectRoles: ["available_on"],
          eligibleCreditRoles: [],
        },
      },
      translations: {
        create: [
          { language: DEFAULT_LANGUAGE, title },
          { language: FALLBACK_LANGUAGE, title },
        ],
      },
      supportLanguages: {
        create: [
          { language: DEFAULT_LANGUAGE, isPrimary: true, sortOrder: 0 },
          { language: FALLBACK_LANGUAGE, isPrimary: false, sortOrder: 1 },
        ],
      },
    },
    select: { id: true },
  });

  return unit.id;
}

async function ensureRatingTag(
  prisma: PrismaClient,
  tagScope: string,
  slug: RatingTagSlug,
): Promise<string> {
  const title = RATING_TAG_TITLES[slug];
  const existing = await prisma.unit.findUnique({
    where: { slugScope_slug: { slugScope: tagScope, slug } },
    select: { id: true, type: true },
  });

  if (existing) {
    if (existing.type !== "TAG") {
      throw new Error(
        `[Seed] Slug "${slug}" under tag scope is already used by a non-TAG unit (type=${existing.type}).`,
      );
    }

    await prisma.unit.update({
      where: { id: existing.id },
      data: {
        status: "PUBLISHED",
        visibility: "PUBLIC",
        isLanguageNeutral: true,
        defaultLanguage: DEFAULT_LANGUAGE,
      },
    });
    await syncUnitTranslations(prisma, existing.id, title);
    return existing.id;
  }

  const tag = await prisma.unit.create({
    data: {
      type: "TAG",
      slug,
      slugScope: tagScope,
      status: "PUBLISHED",
      visibility: "PUBLIC",
      isLanguageNeutral: true,
      defaultLanguage: DEFAULT_LANGUAGE,
      publishedAt: new Date(),
      translations: {
        create: [
          { language: DEFAULT_LANGUAGE, title },
          { language: FALLBACK_LANGUAGE, title },
        ],
      },
      supportLanguages: {
        create: [
          { language: DEFAULT_LANGUAGE, isPrimary: true, sortOrder: 0 },
          { language: FALLBACK_LANGUAGE, isPrimary: false, sortOrder: 1 },
        ],
      },
    },
    select: { id: true },
  });

  return tag.id;
}

export interface GameMediaTaxonomySeedResult {
  platformEntityIds: Record<PlatformSlug, string>;
  ratingTagIds: Record<RatingTagSlug, string>;
}

export async function seedGameMediaTaxonomy(
  prisma: PrismaClient,
  slugScopes: SlugScopesMap,
): Promise<GameMediaTaxonomySeedResult> {
  console.log("[Seed] Seeding GAME/MEDIA taxonomy...");

  const platformEntityIds =
    {} as GameMediaTaxonomySeedResult["platformEntityIds"];
  for (const platform of GAME_PLATFORMS) {
    platformEntityIds[platform.slug] = await ensurePlatformEntity(
      prisma,
      slugScopes.entity,
      platform.slug,
      platform.title,
    );
  }

  const ratingTagIds = {} as Record<RatingTagSlug, string>;
  for (const slug of RATING_TAGS) {
    ratingTagIds[slug] = await ensureRatingTag(prisma, slugScopes.tag, slug);
  }

  return { platformEntityIds, ratingTagIds };
}
