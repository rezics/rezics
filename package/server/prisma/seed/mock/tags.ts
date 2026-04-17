import { randomUUID } from "node:crypto";
import { faker } from "@faker-js/faker";
import { DEFAULT_LANGUAGE } from "@rezics/contract";
import type { PrismaClient } from "#/prisma/generated/client.js";
import { UnitStatus, UnitType } from "#/prisma/generated/client.js";
import { generateTranslations } from "./generators.js";
import type { CreatedUnit, CreatedUser } from "./types.js";

/**
 * Seed tags as Unit(type=TAG) + UnitTranslation + UnitSupportLanguage.
 * Uses two-phase createMany for maximum throughput.
 */
export async function seedTags(
  prisma: PrismaClient,
  total: number,
  users: CreatedUser[],
): Promise<CreatedUnit[]> {
  console.log(`[Seed] Seeding ${total} tags...`);

  const tags = Array.from({ length: total }, () => {
    const id = randomUUID();
    const user = faker.helpers.arrayElement(users);
    const translations = generateTranslations(UnitType.TAG);
    return { id, userId: user.unitId, translations };
  });

  // Phase 1: Create Unit rows
  await prisma.unit.createMany({
    data: tags.map((t) => ({
      id: t.id,
      type: UnitType.TAG,
      userId: t.userId,
      status: UnitStatus.PUBLISHED,
      isLanguageNeutral: false,
      defaultLanguage: DEFAULT_LANGUAGE,
      publishedAt: faker.date.past({ years: 1 }),
    })),
  });

  // Phase 2: Create UnitTranslation rows (all languages)
  await prisma.unitTranslation.createMany({
    data: tags.flatMap((t) =>
      t.translations.map((tr) => ({
        unitId: t.id,
        language: tr.language,
        title: tr.title,
        description: tr.description,
      })),
    ),
  });

  // Phase 3: Create UnitSupportLanguage rows
  await prisma.unitSupportLanguage.createMany({
    data: tags.flatMap((t) =>
      t.translations.map((tr, i) => ({
        unitId: t.id,
        language: tr.language,
        isPrimary: i === 0,
        sortOrder: i,
      })),
    ),
  });

  return tags.map((t) => ({ id: t.id, type: UnitType.TAG }));
}
