import { randomUUID } from "node:crypto";
import { faker } from "@faker-js/faker";
import {
  DEFAULT_LANGUAGE,
  DEFAULT_PUBLICATION_LICENSE_SLUG,
} from "@rezics/contract";
import { rebalance } from "../../shelf/fractional-index.js";
import { Media, Unit, UnitSupportLanguage, UnitTranslation } from "../schema";
import {
  type FactoryCreditAttributionInsert,
  type FactoryUnitTagInsert,
  flushCreditAttributionsAndTags,
} from "./books.js";
import { MEDIA_KIND_KEYS } from "./data.js";
import { generateMediaExtra, generateTranslations } from "./generators.js";
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

const MEDIA_PERSON_ROLES = ["director", "actor", "composer", "narrator"];
const MEDIA_ORG_ROLES = ["studio", "distributor"];

export async function seedMedia(
  ctx: SeedCtx,
  spec: CountSpec,
  users: CreatedUser[],
  people: CreatedEntity[],
  organizations: CreatedEntity[],
  tags: CreatedUnit[],
): Promise<CreatedUnit[]> {
  const total = ctx.draw(spec);
  console.log(`[Seed] Seeding ${total} media...`);

  const allCreditAttributions: FactoryCreditAttributionInsert[] = [];
  const allTagLinks: FactoryUnitTagInsert[] = [];

  const created = await chunkedParallel(
    Array.from({ length: total }),
    CHUNK_SIZE,
    async () => {
      const author = faker.helpers.arrayElement(users);
      const translations = generateTranslations(UnitType.MEDIA);
      const kindKey = faker.helpers.arrayElement([...MEDIA_KIND_KEYS]);
      const isTV = kindKey === "TV_SERIES" || kindKey === "ANIME";

      const unit = { id: randomUUID(), type: UnitType.MEDIA };
      await ctx.db.insert(Unit).values(
        withUpdatedAt({
          id: unit.id,
          type: UnitType.MEDIA,
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
      await ctx.db.insert(Media).values(
        withUpdatedAt({
          unitId: unit.id,
          kindKey,
          releaseDate: randomBoolean(0.7)
            ? faker.date.past({ years: 20 })
            : null,
          runtimeMinutes: isTV ? null : randomInt(80, 210),
          episodeCount: isTV ? randomInt(6, 200) : null,
          seasonCount: isTV ? randomInt(1, 10) : null,
          extra: generateMediaExtra(),
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

      const pickedPeople = pickN(people, randomInt(1, 4));
      const peoplePositions = rebalance(pickedPeople.length);
      for (const [i, p] of pickedPeople.entries()) {
        allCreditAttributions.push({
          unitId: unit.id,
          entityId: p.unitId,
          role: faker.helpers.arrayElement(MEDIA_PERSON_ROLES),
          position: peoplePositions[i]!,
        });
      }
      const pickedOrganizations = pickN(organizations, randomInt(1, 2));
      const organizationPositions = rebalance(pickedOrganizations.length);
      for (const [i, o] of pickedOrganizations.entries()) {
        allCreditAttributions.push({
          unitId: unit.id,
          entityId: o.unitId,
          role: faker.helpers.arrayElement(MEDIA_ORG_ROLES),
          position: organizationPositions[i]!,
        });
      }
      for (const t of pickN(tags, randomInt(1, 5))) {
        allTagLinks.push(withUpdatedAt({ unitId: unit.id, tagUnitId: t.id }));
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
