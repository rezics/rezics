import { faker } from "@faker-js/faker";
import { DEFAULT_LANGUAGE } from "@rezics/contract";
import type { Prisma } from "../generated/client.js";
import { UnitStatus, UnitType } from "../generated/client.js";
import { flushAttributionsAndTags } from "./books.js";
import { PLATFORM_KEYS } from "./data.js";
import { generateGameExtra, generateTranslations } from "./generators.js";
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

  const allAttributions: Prisma.AttributionCreateManyInput[] = [];
  const allTagLinks: Prisma.UnitTagCreateManyInput[] = [];

  const created = await chunkedParallel(
    Array.from({ length: total }),
    CHUNK_SIZE,
    async () => {
      const author = faker.helpers.arrayElement(users);
      const translations = generateTranslations(UnitType.GAME);
      const platforms = pickN([...PLATFORM_KEYS], randomInt(1, 4));

      const unit = await ctx.prisma.unit.create({
        data: {
          type: UnitType.GAME,
          userId: author.userId,
          slugScope: author.userId,
          status: randomBoolean(0.85) ? UnitStatus.PUBLISHED : UnitStatus.DRAFT,
          defaultLanguage: DEFAULT_LANGUAGE,
          publishedAt: randomBoolean(0.8)
            ? faker.date.past({ years: 5 })
            : null,
          game: {
            create: {
              releaseDate: randomBoolean(0.7)
                ? faker.date.past({ years: 10 })
                : null,
              versionLabel: randomBoolean(0.5)
                ? `v${randomInt(1, 5)}.${randomInt(0, 9)}`
                : null,
              ageRatingKey: faker.helpers.arrayElement([
                "E",
                "T",
                "M",
                "AO",
                null,
              ]),
              extra: generateGameExtra(),
              platforms: {
                createMany: {
                  data: platforms.map((p, i) => ({
                    platformKey: p,
                    sortOrder: i,
                  })),
                },
              },
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

      for (const [i, p] of pickN(people, randomInt(1, 3)).entries()) {
        allAttributions.push({
          unitId: unit.id,
          entityId: p.unitId,
          role: faker.helpers.arrayElement(GAME_PERSON_ROLES),
          sortOrder: i,
        });
      }
      for (const [i, o] of pickN(organizations, randomInt(1, 2)).entries()) {
        allAttributions.push({
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

  await flushAttributionsAndTags(ctx.prisma, allAttributions, allTagLinks);
  return created;
}
