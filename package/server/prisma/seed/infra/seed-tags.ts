import {
  DEFAULT_LANGUAGE,
  FALLBACK_LANGUAGE,
  SEED_TAG_NAMES,
  SEED_TAG_POSITIONS,
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
import type { PrismaClient } from "#/prisma/generated/client";

export const SEARCH_TAG_IDS_ECHOKV_KEY = "tagids";

/**
 * Seed content-type tags with DB-generated UUIDv7 IDs and contract slugs.
 * Idempotent: looks up existing tags by Unit.slug (from SEED_TAG_SLUGS).
 * Returns a name→ID map.
 */
export async function seedContentTypeTags(
  prisma: PrismaClient,
): Promise<Record<SeedTagName, string>> {
  console.log("[Seed] Seeding content-type tags...");

  const tagMap = {} as Record<SeedTagName, string>;

  for (const name of SEED_TAG_NAMES) {
    const title = SEED_TAG_TITLES[name];
    const slug = SEED_TAG_SLUGS[name];

    const existing = await prisma.unit.findUnique({
      where: { slug },
      select: { id: true, type: true },
    });

    if (existing) {
      if (existing.type !== "TAG") {
        throw new Error(
          `[Seed] Slug "${slug}" is already used by a non-TAG unit (type=${existing.type}).`,
        );
      }
      console.log(
        `[Seed]   Content-type tag "${name}" already exists, skipping.`,
      );
      tagMap[name] = existing.id;
    } else {
      const unit = await prisma.unit.create({
        data: {
          type: "TAG",
          slug,
          status: "PUBLISHED",
          visibility: "PUBLIC",
          isLanguageNeutral: true,
          publishedAt: new Date(),
          defaultLanguage: DEFAULT_LANGUAGE,
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
      tagMap[name] = unit.id;
      console.log(
        `[Seed]   Created content-type tag "${name}" (${unit.id}, slug=${slug})`,
      );
    }

    const position = SEED_TAG_POSITIONS[name];

    await prisma.unitTag.upsert({
      where: {
        unitId_tagUnitId: { unitId: tagMap[name], tagUnitId: tagMap[name] },
      },
      update: { pinned: true, position },
      create: {
        unitId: tagMap[name],
        tagUnitId: tagMap[name],
        score: 0,
        voteCount: 0,
        pinned: true,
        position,
      },
    });
  }

  return tagMap;
}

async function syncTagTranslations(
  prisma: PrismaClient,
  unitId: string,
  slug: TagSlug,
): Promise<void> {
  const entry = TAGS[slug];

  await Promise.all(
    TAG_REGISTRY_LANGUAGES.map((language, sortOrder) =>
      Promise.all([
        prisma.unitTranslation.upsert({
          where: { unitId_language: { unitId, language } },
          update: { title: entry[language] },
          create: { unitId, language, title: entry[language] },
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

async function ensureSearchTag(
  prisma: PrismaClient,
  slug: TagSlug,
): Promise<string> {
  const existing = await prisma.unit.findUnique({
    where: { slug },
    select: { id: true, type: true },
  });

  if (existing) {
    if (existing.type !== "TAG") {
      throw new Error(
        `[Seed] Slug "${slug}" is already used by a non-TAG unit (type=${existing.type}).`,
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
    await syncTagTranslations(prisma, existing.id, slug);
    return existing.id;
  }

  const tag = await prisma.unit.create({
    data: {
      type: "TAG",
      slug,
      status: "PUBLISHED",
      visibility: "PUBLIC",
      isLanguageNeutral: true,
      defaultLanguage: DEFAULT_LANGUAGE,
      publishedAt: new Date(),
      translations: {
        create: TAG_REGISTRY_LANGUAGES.map((language) => ({
          language,
          title: TAGS[slug][language],
        })),
      },
      supportLanguages: {
        create: TAG_REGISTRY_LANGUAGES.map((language, sortOrder) => ({
          language,
          isPrimary: language === DEFAULT_LANGUAGE,
          sortOrder,
        })),
      },
    },
    select: { id: true },
  });

  return tag.id;
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
 * IDs into EchoKV. TAG Units are canonical by slug; EchoKV is a runtime ID map.
 */
export async function seedSearchTagIds(
  prisma: PrismaClient,
): Promise<TagGroupIds> {
  console.log("[Seed] Seeding search tag registry...");

  const tagIdBySlug = {} as Record<TagSlug, string>;

  for (const slug of Object.keys(TAGS) as TagSlug[]) {
    tagIdBySlug[slug] = await ensureSearchTag(prisma, slug);
  }

  const tagIds = buildSearchTagIds(tagIdBySlug);

  await prisma.echoKV.upsert({
    where: { key: SEARCH_TAG_IDS_ECHOKV_KEY },
    update: { value: tagIds },
    create: {
      key: SEARCH_TAG_IDS_ECHOKV_KEY,
      value: tagIds,
    },
  });

  console.log(
    `[Seed]   EchoKV "${SEARCH_TAG_IDS_ECHOKV_KEY}" updated with ${Object.keys(TAGS).length} unique tags.`,
  );

  return tagIds;
}
