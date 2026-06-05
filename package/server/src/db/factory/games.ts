import { randomUUID } from "node:crypto";
import { faker } from "@faker-js/faker";
import {
  DEFAULT_LANGUAGE,
  DEFAULT_PUBLICATION_LICENSE_SLUG,
} from "@rezics/contract";
import { Game, Unit, UnitSupportLanguage, UnitTranslation } from "../schema";
import {
  type FactoryCreditAttributionInsert,
  type FactoryUnitTagInsert,
  flushCreditAttributionsAndTags,
} from "./books.js";
import { generateGameExtra, generateTranslations } from "./generators.js";
import { UnitStatus, UnitType } from "./storage-values.js";
import type { CountSpec, SeedCtx } from "./strategy.js";
import type { CreatedEntity, CreatedUnit, CreatedUser } from "./types.js";
import { chunkedParallel, pickN, randomBoolean, randomInt } from "./utils.js";

const CHUNK_SIZE = 10;

const GAME_PERSON_ROLES = ["director", "composer", "designer"];
const GAME_ORG_ROLES = ["developer", "publisher"];

export async function seedGames(
  ctx: SeedCtx,
  spec: CountSpec,
  users: CreatedUser[],
  people: CreatedEntity[],
  organizations: CreatedEntity[],
  tags: CreatedUnit[],
): Promise<CreatedUnit[]> {
  const total = ctx.draw(spec);
  console.log(`[Seed] Seeding ${total} games...`);

  const allCreditAttributions: FactoryCreditAttributionInsert[] = [];
  const allTagLinks: FactoryUnitTagInsert[] = [];

  const created = await chunkedParallel(
    Array.from({ length: total }),
    CHUNK_SIZE,
    async () => {
      const author = faker.helpers.arrayElement(users);
      const translations = generateTranslations(UnitType.GAME);

      const unit = { id: randomUUID(), type: UnitType.GAME };
      await ctx.db.insert(Unit).values({
        id: unit.id,
        type: UnitType.GAME,
        userId: author.userId,
        slugScope: author.userId,
        status: randomBoolean(0.85) ? UnitStatus.PUBLISHED : UnitStatus.DRAFT,
        licenseSlug: DEFAULT_PUBLICATION_LICENSE_SLUG,
        defaultLanguage: DEFAULT_LANGUAGE,
        publishedAt: randomBoolean(0.8) ? faker.date.past({ years: 5 }) : null,
      });
      await ctx.db.insert(Game).values({
        unitId: unit.id,
        releaseDate: randomBoolean(0.7) ? faker.date.past({ years: 10 }) : null,
        versionLabel: randomBoolean(0.5)
          ? `v${randomInt(1, 5)}.${randomInt(0, 9)}`
          : null,
        extra: generateGameExtra(),
      });
      await ctx.db.insert(UnitTranslation).values(
        translations.map((t) => ({
          unitId: unit.id,
          language: t.language,
          title: t.title,
          summary: t.summary,
          description: t.description,
        })),
      );
      await ctx.db.insert(UnitSupportLanguage).values(
        translations.map((t, i) => ({
          unitId: unit.id,
          language: t.language,
          isPrimary: i === 0,
          sortOrder: i,
        })),
      );

      for (const [i, p] of pickN(people, randomInt(1, 3)).entries()) {
        allCreditAttributions.push({
          unitId: unit.id,
          entityId: p.unitId,
          role: faker.helpers.arrayElement(GAME_PERSON_ROLES),
          sortOrder: i,
        });
      }
      for (const [i, o] of pickN(organizations, randomInt(1, 2)).entries()) {
        allCreditAttributions.push({
          unitId: unit.id,
          entityId: o.unitId,
          role: faker.helpers.arrayElement(GAME_ORG_ROLES),
          sortOrder: i,
        });
      }
      for (const t of pickN(tags, randomInt(1, 5))) {
        allTagLinks.push({ unitId: unit.id, tagUnitId: t.id });
      }

      return unit;
    },
  );

  await flushCreditAttributionsAndTags(
    ctx.db,
    allCreditAttributions,
    allTagLinks,
  );
  return created;
}
