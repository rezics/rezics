import {
  DEFAULT_LANGUAGE,
  FALLBACK_LANGUAGE,
  SEED_TAG_NAMES,
  SEED_TAG_SCORE,
  SEED_TAG_SLUGS,
  SEED_TAG_TITLES,
  type SeedTagName,
} from "@rezics/contract";
import type { PrismaClient } from "#/prisma/generated/client";

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

    await prisma.unitTag.upsert({
      where: {
        unitId_tagUnitId: { unitId: tagMap[name], tagUnitId: tagMap[name] },
      },
      update: { score: SEED_TAG_SCORE },
      create: {
        unitId: tagMap[name],
        tagUnitId: tagMap[name],
        score: SEED_TAG_SCORE,
        voteCount: 0,
      },
    });
  }

  return tagMap;
}
