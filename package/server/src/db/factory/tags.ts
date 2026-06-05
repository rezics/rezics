import { randomUUID } from "node:crypto";
import { faker } from "@faker-js/faker";
import { DEFAULT_LANGUAGE } from "@rezics/contract";
import { UnitStatus, UnitType } from "./storage-values.js";
import { Unit, UnitSupportLanguage, UnitTranslation } from "../schema";
import { generateTranslations } from "./generators.js";
import type { CountSpec, SeedCtx } from "./strategy.js";
import type { CreatedUnit, CreatedUser } from "./types.js";

/**
 * Seed tags as Unit(type=TAG) + UnitTranslation + UnitSupportLanguage.
 * Uses three-phase bulk inserts for maximum throughput.
 */
export async function seedTags(
  ctx: SeedCtx,
  spec: CountSpec,
  users: CreatedUser[],
): Promise<CreatedUnit[]> {
  const total = ctx.draw(spec);
  console.log(`[Seed] Seeding ${total} tags...`);

  const tags = Array.from({ length: total }, () => {
    const id = randomUUID();
    const user = faker.helpers.arrayElement(users);
    const translations = generateTranslations(UnitType.TAG);
    return { id, userId: user.userId, translations };
  });

  if (tags.length === 0) return [];

  // Phase 1: Create Unit rows
  await ctx.db.insert(Unit).values(
    tags.map((t) => ({
      id: t.id,
      type: UnitType.TAG,
      userId: t.userId,
      slugScope: ctx.slugScopes.tag,
      status: UnitStatus.PUBLISHED,
      isLanguageNeutral: false,
      defaultLanguage: DEFAULT_LANGUAGE,
      publishedAt: faker.date.past({ years: 1 }),
    })),
  );

  // Phase 2: Create UnitTranslation rows (all languages)
  await ctx.db.insert(UnitTranslation).values(
    tags.flatMap((t) =>
      t.translations.map((tr) => ({
        unitId: t.id,
        language: tr.language,
        title: tr.title,
        description: tr.description,
      })),
    ),
  );

  // Phase 3: Create UnitSupportLanguage rows
  await ctx.db.insert(UnitSupportLanguage).values(
    tags.flatMap((t) =>
      t.translations.map((tr, i) => ({
        unitId: t.id,
        language: tr.language,
        isPrimary: i === 0,
        sortOrder: i,
      })),
    ),
  );

  return tags.map((t) => ({ id: t.id, type: UnitType.TAG }));
}
