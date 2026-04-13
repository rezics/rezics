import { randomUUID } from "node:crypto";
import { faker } from "@faker-js/faker";
import { DEFAULT_LANGUAGE } from "@rezics/contract";
import type { PrismaClient } from "#/prisma/generated/client.js";
import { UnitStatus, UnitType } from "#/prisma/generated/client.js";
import { generateTranslation } from "./generators.js";
import type { CreatedUnit, CreatedUser } from "./types.js";

/**
 * Seed tags as Unit(type=TAG) + UnitTranslation.
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
    const translation = generateTranslation(UnitType.TAG);
    return { id, userId: user.unitId, title: translation.title };
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

  // Phase 2: Create UnitTranslation rows
  await prisma.unitTranslation.createMany({
    data: tags.map((t) => ({
      unitId: t.id,
      language: DEFAULT_LANGUAGE,
      title: t.title,
    })),
  });

  return tags.map((t) => ({ id: t.id, type: UnitType.TAG }));
}
