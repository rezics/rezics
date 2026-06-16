import { randomUUID } from "node:crypto";
import { faker } from "@faker-js/faker";
import { DEFAULT_LANGUAGE } from "@rezics/contract";
import { rebalance } from "../../shelf/fractional-index.js";
import { Unit, UnitSupportLanguage, UnitTranslation } from "../schema";
import { generateTranslations } from "./generators.js";
import { UnitStatus, UnitType } from "./storage-values.js";
import type { CountSpec, SeedCtx } from "./strategy.js";
import type { CreatedUnit, CreatedUser } from "./types.js";
import { withUpdatedAtRows } from "./utils.js";

/**
 * Seed tags as Unit(type=TAG) + UnitTranslation + UnitSupportLanguage.
 * Uses three-phase bulk inserts for maximum throughput.
 * 以 Unit(type=TAG) + UnitTranslation + UnitSupportLanguage 的形式播种标签。
 * 使用三阶段批量插入以获得最大吞吐量。
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
  // 阶段 1：创建 Unit 行
  await ctx.db.insert(Unit).values(
    withUpdatedAtRows(
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
    ),
  );

  // Phase 2: Create UnitTranslation rows (all languages)
  // 阶段 2：创建 UnitTranslation 行（所有语言）
  await ctx.db.insert(UnitTranslation).values(
    withUpdatedAtRows(
      tags.flatMap((t) =>
        t.translations.map((tr) => ({
          unitId: t.id,
          language: tr.language,
          title: tr.title,
          description: tr.description,
        })),
      ),
    ),
  );

  // Phase 3: Create UnitSupportLanguage rows
  // 阶段 3：创建 UnitSupportLanguage 行
  await ctx.db.insert(UnitSupportLanguage).values(
    withUpdatedAtRows(
      tags.flatMap((t) =>
        t.translations.map((tr, i) => ({
          unitId: t.id,
          language: tr.language,
          isPrimary: i === 0,
          position: rebalance(t.translations.length)[i]!,
        })),
      ),
    ),
  );

  return tags.map((t) => ({ id: t.id, type: UnitType.TAG }));
}
