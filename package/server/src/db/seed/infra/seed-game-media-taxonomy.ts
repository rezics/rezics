import {
  DEFAULT_LANGUAGE,
  FALLBACK_LANGUAGE,
  RATING_TAGS,
  type RatingTagSlug,
} from "@rezics/contract";
import { and, eq } from "drizzle-orm";
import type { ServerDb } from "../../client";
import {
  Entity,
  Unit,
  UnitSupportLanguage,
  UnitTranslation,
} from "../../schema";
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

type GameMediaSeedDb = Pick<
  ServerDb,
  "insert" | "select" | "transaction" | "update"
>;
type GameMediaWriteDb = Pick<ServerDb, "insert">;

async function findUnitByScopedSlug(
  db: GameMediaSeedDb,
  slugScope: string,
  slug: string,
): Promise<{ id: string; type: string } | null> {
  return (
    (
      await db
        .select({ id: Unit.id, type: Unit.type })
        .from(Unit)
        .where(and(eq(Unit.slugScope, slugScope), eq(Unit.slug, slug)))
        .limit(1)
    )[0] ?? null
  );
}

async function syncUnitTranslations(
  db: GameMediaWriteDb,
  unitId: string,
  title: string,
): Promise<void> {
  for (const [sortOrder, language] of [
    DEFAULT_LANGUAGE,
    FALLBACK_LANGUAGE,
  ].entries()) {
    await db
      .insert(UnitTranslation)
      .values({
        unitId,
        language,
        title,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [UnitTranslation.unitId, UnitTranslation.language],
        set: { title, updatedAt: new Date() },
      });
    await db
      .insert(UnitSupportLanguage)
      .values({
        unitId,
        language,
        isPrimary: language === DEFAULT_LANGUAGE,
        sortOrder,
      })
      .onConflictDoUpdate({
        target: [UnitSupportLanguage.unitId, UnitSupportLanguage.language],
        set: {
          isPrimary: language === DEFAULT_LANGUAGE,
          sortOrder,
        },
      });
  }
}

async function ensurePlatformEntity(
  db: GameMediaSeedDb,
  entityScope: string,
  slug: string,
  title: string,
): Promise<string> {
  const existing = await findUnitByScopedSlug(db, entityScope, slug);

  if (existing) {
    if (existing.type !== "ENTITY") {
      throw new Error(
        `[Seed] Slug "${slug}" under entity scope is already used by a non-ENTITY unit (type=${existing.type}).`,
      );
    }

    await db
      .insert(Entity)
      .values({
        unitId: existing.id,
        kind: "game_platform",
        verified: true,
        eligibleSubjectRoles: ["available_on"],
        eligibleCreditRoles: [],
      })
      .onConflictDoUpdate({
        target: Entity.unitId,
        set: {
          kind: "game_platform",
          verified: true,
          eligibleSubjectRoles: ["available_on"],
        },
      });
    await syncUnitTranslations(db, existing.id, title);
    return existing.id;
  }

  return db.transaction(async (tx) => {
    const now = new Date();
    const [unit] = await tx
      .insert(Unit)
      .values({
        type: "ENTITY",
        slug,
        slugScope: entityScope,
        status: "PUBLISHED",
        visibility: "PUBLIC",
        isLanguageNeutral: true,
        defaultLanguage: DEFAULT_LANGUAGE,
        publishedAt: now,
        updatedAt: now,
      })
      .returning({ id: Unit.id });
    if (!unit) throw new Error(`Failed to create platform entity "${slug}"`);

    await tx.insert(Entity).values({
      unitId: unit.id,
      kind: "game_platform",
      verified: true,
      eligibleSubjectRoles: ["available_on"],
      eligibleCreditRoles: [],
    });
    await syncUnitTranslations(tx, unit.id, title);
    return unit.id;
  });
}

async function ensureRatingTag(
  db: GameMediaSeedDb,
  tagScope: string,
  slug: RatingTagSlug,
): Promise<string> {
  const title = RATING_TAG_TITLES[slug];
  const existing = await findUnitByScopedSlug(db, tagScope, slug);

  if (existing) {
    if (existing.type !== "TAG") {
      throw new Error(
        `[Seed] Slug "${slug}" under tag scope is already used by a non-TAG unit (type=${existing.type}).`,
      );
    }

    await db
      .update(Unit)
      .set({
        status: "PUBLISHED",
        visibility: "PUBLIC",
        isLanguageNeutral: true,
        defaultLanguage: DEFAULT_LANGUAGE,
        updatedAt: new Date(),
      })
      .where(eq(Unit.id, existing.id));
    await syncUnitTranslations(db, existing.id, title);
    return existing.id;
  }

  return db.transaction(async (tx) => {
    const now = new Date();
    const [tag] = await tx
      .insert(Unit)
      .values({
        type: "TAG",
        slug,
        slugScope: tagScope,
        status: "PUBLISHED",
        visibility: "PUBLIC",
        isLanguageNeutral: true,
        defaultLanguage: DEFAULT_LANGUAGE,
        publishedAt: now,
        updatedAt: now,
      })
      .returning({ id: Unit.id });
    if (!tag) throw new Error(`Failed to create rating tag "${slug}"`);

    await syncUnitTranslations(tx, tag.id, title);
    return tag.id;
  });
}

export interface GameMediaTaxonomySeedResult {
  platformEntityIds: Record<PlatformSlug, string>;
  ratingTagIds: Record<RatingTagSlug, string>;
}

export async function seedGameMediaTaxonomy(
  db: GameMediaSeedDb,
  slugScopes: SlugScopesMap,
): Promise<GameMediaTaxonomySeedResult> {
  console.log("[Seed] Seeding GAME/MEDIA taxonomy...");

  const platformEntityIds =
    {} as GameMediaTaxonomySeedResult["platformEntityIds"];
  for (const platform of GAME_PLATFORMS) {
    platformEntityIds[platform.slug] = await ensurePlatformEntity(
      db,
      slugScopes.entity,
      platform.slug,
      platform.title,
    );
  }

  const ratingTagIds = {} as Record<RatingTagSlug, string>;
  for (const slug of RATING_TAGS) {
    ratingTagIds[slug] = await ensureRatingTag(db, slugScopes.tag, slug);
  }

  return { platformEntityIds, ratingTagIds };
}
