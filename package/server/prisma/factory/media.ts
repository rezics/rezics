import { faker } from "@faker-js/faker";
import { DEFAULT_LANGUAGE } from "@rezics/contract";
import type { Prisma } from "../generated/client.js";
import { UnitStatus, UnitType } from "../generated/client.js";
import { flushCreditAttributionsAndTags } from "./books.js";
import { MEDIA_KIND_KEYS } from "./data.js";
import { generateMediaExtra, generateTranslations } from "./generators.js";
import type { CountSpec, SeedCtx } from "./strategy.js";
import type { CreatedEntity, CreatedUnit, CreatedUser } from "./types.js";
import { chunkedParallel, pickN, randomBoolean, randomInt } from "./utils.js";

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

  const allCreditAttributions: Prisma.CreditAttributionCreateManyInput[] = [];
  const allTagLinks: Prisma.UnitTagCreateManyInput[] = [];

  const created = await chunkedParallel(
    Array.from({ length: total }),
    CHUNK_SIZE,
    async () => {
      const author = faker.helpers.arrayElement(users);
      const translations = generateTranslations(UnitType.MEDIA);
      const kindKey = faker.helpers.arrayElement([...MEDIA_KIND_KEYS]);
      const isTV = kindKey === "TV_SERIES" || kindKey === "ANIME";

      const unit = await ctx.prisma.unit.create({
        data: {
          type: UnitType.MEDIA,
          userId: author.userId,
          slugScope: author.userId,
          status: randomBoolean(0.85) ? UnitStatus.PUBLISHED : UnitStatus.DRAFT,
          defaultLanguage: DEFAULT_LANGUAGE,
          publishedAt: randomBoolean(0.8)
            ? faker.date.past({ years: 5 })
            : null,
          media: {
            create: {
              kindKey,
              releaseDate: randomBoolean(0.7)
                ? faker.date.past({ years: 20 })
                : null,
              runtimeMinutes: isTV ? null : randomInt(80, 210),
              episodeCount: isTV ? randomInt(6, 200) : null,
              seasonCount: isTV ? randomInt(1, 10) : null,
              extra: generateMediaExtra(),
            },
          },
          translations: {
            create: translations.map((t) => ({
              language: t.language,
              title: t.title,
              summary: t.summary,
              description: t.description,
            })),
          },
          supportLanguages: {
            create: translations.map((t, i) => ({
              language: t.language,
              isPrimary: i === 0,
              sortOrder: i,
            })),
          },
        },
        select: { id: true, type: true },
      });

      for (const [i, p] of pickN(people, randomInt(1, 4)).entries()) {
        allCreditAttributions.push({
          unitId: unit.id,
          entityId: p.unitId,
          role: faker.helpers.arrayElement(MEDIA_PERSON_ROLES),
          sortOrder: i,
        });
      }
      for (const [i, o] of pickN(organizations, randomInt(1, 2)).entries()) {
        allCreditAttributions.push({
          unitId: unit.id,
          entityId: o.unitId,
          role: faker.helpers.arrayElement(MEDIA_ORG_ROLES),
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
    ctx.prisma,
    allCreditAttributions,
    allTagLinks,
  );
  return created;
}
