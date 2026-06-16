import {
  DEFAULT_LANGUAGE,
  FALLBACK_LANGUAGE,
  OFFICIAL_QUESTION_TAG_SLUG,
  SEED_TAG_NAMES,
  SEED_TAG_SLUGS,
  SEED_TAG_TITLES,
  type SeedTagName,
  TAG_GROUPS,
  TAG_REGISTRY_LANGUAGES,
  TAGS,
  type TagGroupIds,
  type TagGroupName,
  type TagSlug,
} from "@rezics/contract";
import { and, eq } from "drizzle-orm";
import { rebalance } from "../../../shelf/fractional-index";
import type { ServerDb } from "../../client";
import {
  EchoKV,
  Unit,
  UnitSupportLanguage,
  UnitTranslation,
} from "../../schema";
import type { SlugScopesMap } from "./seed-slug-scopes";

export const SEARCH_TAG_IDS_ECHOKV_KEY = "tagids";
type TagSeedDb = Pick<ServerDb, "insert" | "select" | "transaction" | "update">;

export interface ContentTypeTagsSeedResult {
  tagMap: Record<SeedTagName, string>;
  officialQuestionTagId: string;
}

async function findUnitByScopedSlug(
  db: TagSeedDb,
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

async function createTagUnit(
  db: TagSeedDb,
  input: {
    slug: string;
    slugScope: string;
    translations: Array<{ language: string; title: string }>;
    supportLanguages: Array<{
      language: string;
      isPrimary: boolean;
      position: string;
    }>;
  },
): Promise<string> {
  return db.transaction(async (tx) => {
    const now = new Date();
    const [unit] = await tx
      .insert(Unit)
      .values({
        type: "TAG",
        slug: input.slug,
        slugScope: input.slugScope,
        status: "PUBLISHED",
        visibility: "PUBLIC",
        isLanguageNeutral: true,
        publishedAt: now,
        defaultLanguage: DEFAULT_LANGUAGE,
        updatedAt: now,
      })
      .returning({ id: Unit.id });
    if (!unit) throw new Error(`Failed to create tag Unit "${input.slug}"`);

    for (const translation of input.translations) {
      await tx.insert(UnitTranslation).values({
        unitId: unit.id,
        language: translation.language,
        title: translation.title,
        updatedAt: now,
      });
    }

    for (const supportLanguage of input.supportLanguages) {
      await tx.insert(UnitSupportLanguage).values({
        unitId: unit.id,
        language: supportLanguage.language,
        isPrimary: supportLanguage.isPrimary,
        position: supportLanguage.position,
      });
    }

    return unit.id;
  });
}

/**
 * Seed content-type tags with DB-generated UUIDv7 IDs and contract slugs.
 * Idempotent: looks up existing tags by `(tagScope, slug)`.
 * Returns a name→ID map.
 */
export async function seedContentTypeTags(
  db: TagSeedDb,
  slugScopes: SlugScopesMap,
): Promise<ContentTypeTagsSeedResult> {
  console.log("[Seed] Seeding content-type tags...");

  const tagScope = slugScopes.tag;
  const tagMap = {} as Record<SeedTagName, string>;

  for (const name of SEED_TAG_NAMES) {
    const title = SEED_TAG_TITLES[name];
    const slug = SEED_TAG_SLUGS[name];

    const existing = await findUnitByScopedSlug(db, tagScope, slug);

    if (existing) {
      if (existing.type !== "TAG") {
        throw new Error(
          `[Seed] Slug "${slug}" under tag scope is already used by a non-TAG unit (type=${existing.type}).`,
        );
      }
      console.log(
        `[Seed]   Content-type tag "${name}" already exists, skipping.`,
      );
      tagMap[name] = existing.id;
    } else {
      const id = await createTagUnit(db, {
        slug,
        slugScope: tagScope,
        translations: [
          { language: DEFAULT_LANGUAGE, title },
          { language: FALLBACK_LANGUAGE, title },
        ],
        supportLanguages: [
          {
            language: DEFAULT_LANGUAGE,
            isPrimary: true,
            position: rebalance(2)[0]!,
          },
          {
            language: FALLBACK_LANGUAGE,
            isPrimary: false,
            position: rebalance(2)[1]!,
          },
        ],
      });
      tagMap[name] = id;
      console.log(
        `[Seed]   Created content-type tag "${name}" (${id}, slug=${slug})`,
      );
    }
  }

  const officialQuestionTagId = await seedOfficialQuestionTag(db, tagScope);

  return { tagMap, officialQuestionTagId };
}

/**
 * Seed the platform-reserved question tag (a `Unit(type=TAG)` whose slug equals
 * `OFFICIAL_QUESTION_TAG_SLUG`). A root post bearing this tag makes its thread a
 * Q&A thread, enabling accepted answers. Idempotent on `(tagScope, slug)`.
 */
async function seedOfficialQuestionTag(
  db: TagSeedDb,
  tagScope: string,
): Promise<string> {
  const slug = OFFICIAL_QUESTION_TAG_SLUG;
  const existing = await findUnitByScopedSlug(db, tagScope, slug);

  if (existing) {
    if (existing.type !== "TAG") {
      throw new Error(
        `[Seed] Slug "${slug}" under tag scope is already used by a non-TAG unit (type=${existing.type}).`,
      );
    }
    console.log(`[Seed]   Official question tag already exists, skipping.`);
    return existing.id;
  }

  const id = await createTagUnit(db, {
    slug,
    slugScope: tagScope,
    translations: [
      { language: DEFAULT_LANGUAGE, title: "Question" },
      { language: FALLBACK_LANGUAGE, title: "Question" },
    ],
    supportLanguages: [
      {
        language: DEFAULT_LANGUAGE,
        isPrimary: true,
        position: rebalance(2)[0]!,
      },
      {
        language: FALLBACK_LANGUAGE,
        isPrimary: false,
        position: rebalance(2)[1]!,
      },
    ],
  });
  console.log(`[Seed]   Created official question tag (${id})`);
  return id;
}

async function syncTagTranslations(
  db: TagSeedDb,
  unitId: string,
  slug: TagSlug,
): Promise<void> {
  const entry = TAGS[slug];

  await Promise.all(
    TAG_REGISTRY_LANGUAGES.map((language, index) =>
      Promise.all([
        db
          .insert(UnitTranslation)
          .values({
            unitId,
            language,
            title: entry[language],
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [UnitTranslation.unitId, UnitTranslation.language],
            set: { title: entry[language], updatedAt: new Date() },
          }),
        db
          .insert(UnitSupportLanguage)
          .values({
            unitId,
            language,
            isPrimary: language === DEFAULT_LANGUAGE,
            position: rebalance(TAG_REGISTRY_LANGUAGES.length)[index]!,
          })
          .onConflictDoUpdate({
            target: [UnitSupportLanguage.unitId, UnitSupportLanguage.language],
            set: {
              isPrimary: language === DEFAULT_LANGUAGE,
              position: rebalance(TAG_REGISTRY_LANGUAGES.length)[index]!,
            },
          }),
      ]),
    ),
  );
}

async function ensureSearchTag(
  db: TagSeedDb,
  tagScope: string,
  slug: TagSlug,
): Promise<string> {
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
    await syncTagTranslations(db, existing.id, slug);
    return existing.id;
  }

  return createTagUnit(db, {
    slug,
    slugScope: tagScope,
    translations: TAG_REGISTRY_LANGUAGES.map((language) => ({
      language,
      title: TAGS[slug][language],
    })),
    supportLanguages: TAG_REGISTRY_LANGUAGES.map((language, index) => ({
      language,
      isPrimary: language === DEFAULT_LANGUAGE,
      position: rebalance(TAG_REGISTRY_LANGUAGES.length)[index]!,
    })),
  });
}

function buildSearchTagIds(tagIdBySlug: Record<TagSlug, string>): TagGroupIds {
  const tagIds = {} as TagGroupIds;

  for (const [groupName, slugs] of Object.entries(TAG_GROUPS) as [
    TagGroupName,
    readonly TagSlug[],
  ][]) {
    tagIds[groupName] = slugs.map((slug) => tagIdBySlug[slug]);
  }

  return tagIds;
}

/**
 * Seed the shared search/forum tag registry and materialize per-category tag
 * IDs into EchoKV. TAG Units are canonical by `(tagScope, slug)`; EchoKV is
 * a runtime ID map.
 */
export async function seedSearchTagIds(
  db: TagSeedDb,
  slugScopes: SlugScopesMap,
): Promise<TagGroupIds> {
  console.log("[Seed] Seeding search tag registry...");

  const tagScope = slugScopes.tag;
  const tagIdBySlug = {} as Record<TagSlug, string>;

  for (const slug of Object.keys(TAGS) as TagSlug[]) {
    tagIdBySlug[slug] = await ensureSearchTag(db, tagScope, slug);
  }

  const tagIds = buildSearchTagIds(tagIdBySlug);

  await db
    .insert(EchoKV)
    .values({
      key: SEARCH_TAG_IDS_ECHOKV_KEY,
      value: tagIds,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: EchoKV.key,
      set: { value: tagIds, updatedAt: new Date() },
    });

  console.log(
    `[Seed]   EchoKV "${SEARCH_TAG_IDS_ECHOKV_KEY}" updated with ${Object.keys(TAGS).length} unique tags.`,
  );

  return tagIds;
}
