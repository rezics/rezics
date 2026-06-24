import { randomUUID } from "node:crypto";
import { faker } from "@faker-js/faker";
import {
  DEFAULT_LANGUAGE,
  DEFAULT_PUBLICATION_LICENSE_SLUG,
} from "@rezics/contract";
import { rebalance } from "../../shelf/fractional-index.js";
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
import {
  chunkedParallel,
  pickN,
  randomBoolean,
  randomInt,
  withUpdatedAt,
  withUpdatedAtRows,
} from "./utils.js";

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
      await ctx.db.insert(Unit).values(
        withUpdatedAt({
          id: unit.id,
          type: UnitType.GAME,
          userId: author.userId,
          slugScope: author.userId,
          status: randomBoolean(0.85) ? UnitStatus.PUBLISHED : UnitStatus.DRAFT,
          licenseSlug: DEFAULT_PUBLICATION_LICENSE_SLUG,
          defaultLanguage: DEFAULT_LANGUAGE,
          publishedAt: randomBoolean(0.8)
            ? faker.date.past({ years: 5 })
            : null,
        }),
      );
      await ctx.db.insert(Game).values(
        withUpdatedAt({
          unitId: unit.id,
          releaseDate: randomBoolean(0.7)
            ? faker.date.past({ years: 10 })
            : null,
          versionLabel: randomBoolean(0.5)
            ? `v${randomInt(1, 5)}.${randomInt(0, 9)}`
            : null,
          extra: generateGameExtra(),
        }),
      );
      await ctx.db.insert(UnitTranslation).values(
        withUpdatedAtRows(
          translations.map((t) => ({
            unitId: unit.id,
            language: t.language,
            title: t.title,
            summary: t.summary,
            description: t.description,
          })),
        ),
      );
      await ctx.db.insert(UnitSupportLanguage).values(
        withUpdatedAtRows(
          translations.map((t, i) => ({
            unitId: unit.id,
            language: t.language,
            isPrimary: i === 0,
            position: rebalance(translations.length)[i]!,
          })),
        ),
      );

      const pickedPeople = pickN(people, randomInt(1, 3));
      const peoplePositions = rebalance(pickedPeople.length);
      for (const [i, p] of pickedPeople.entries()) {
        allCreditAttributions.push({
          unitId: unit.id,
          entityId: p.unitId,
          role: faker.helpers.arrayElement(GAME_PERSON_ROLES),
          position: peoplePositions[i]!,
        });
      }
      const pickedOrganizations = pickN(organizations, randomInt(1, 2));
      const organizationPositions = rebalance(pickedOrganizations.length);
      for (const [i, o] of pickedOrganizations.entries()) {
        allCreditAttributions.push({
          unitId: unit.id,
          entityId: o.unitId,
          role: faker.helpers.arrayElement(GAME_ORG_ROLES),
          position: organizationPositions[i]!,
        });
      }
      for (const t of pickN(tags, randomInt(1, 5))) {
        allTagLinks.push(
          withUpdatedAt({
            unitId: unit.id,
            tagUnitId: t.id,
            score: 1,
            voteCount: 1,
          }),
        );
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
