import type { PrismaClient } from "#/prisma/generated/client.js";
import { UnitStatus, UnitType, UnitVisibility } from "#/prisma/generated/client.js";
import {
  SEED_TAG_IDS,
  SEED_TAG_NAMES,
  SEED_TAG_SCORE,
  SEED_TAG_TITLES,
} from "@rezics/contract";
import type { CreatedUnit } from "./types.js";

/**
 * Seed content-type tags with deterministic UUIDs.
 * Idempotent: skips tags that already exist.
 */
export async function seedContentTypeTags(
  prisma: PrismaClient,
): Promise<CreatedUnit[]> {
  console.log("[Seed] Seeding content-type tags...");

  const created: CreatedUnit[] = [];

  for (const name of SEED_TAG_NAMES) {
    const id = SEED_TAG_IDS[name];
    const title = SEED_TAG_TITLES[name];

    const existing = await prisma.unit.findUnique({ where: { id } });
    if (existing) {
      console.log(`[Seed]   Content-type tag "${name}" already exists, skipping.`);
      created.push({ id, type: UnitType.TAG });
      continue;
    }

    await prisma.unit.create({
      data: {
        id,
        type: UnitType.TAG,
        status: UnitStatus.PUBLISHED,
        visibility: UnitVisibility.PUBLIC,
        isLanguageNeutral: true,
        publishedAt: new Date(),
        translations: {
          create: {
            language: "en",
            title,
          },
        },
      },
    });

    created.push({ id, type: UnitType.TAG });
    console.log(`[Seed]   Created content-type tag "${name}" (${id})`);
  }

  // Set official score boost on each seed tag (self-tag: tag unit tags itself)
  for (const name of SEED_TAG_NAMES) {
    const id = SEED_TAG_IDS[name];
    await prisma.unitTag.upsert({
      where: { unitId_tagUnitId: { unitId: id, tagUnitId: id } },
      update: { score: SEED_TAG_SCORE },
      create: {
        unitId: id,
        tagUnitId: id,
        score: SEED_TAG_SCORE,
        voteCount: 0,
      },
    });
  }

  return created;
}
