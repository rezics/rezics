import { faker } from "@faker-js/faker";
import { DEFAULT_LANGUAGE } from "@rezics/contract";
import type { PrismaClient } from "#/prisma/generated/client.js";
import { UnitStatus, UnitType } from "#/prisma/generated/client.js";
import {
  ORG_ROLE_KEYS,
  PERSON_ROLE_KEYS,
  PLATFORM_KEYS,
} from "./data.js";
import { generateGameExtra, generateTranslations } from "./generators.js";
import type {
  CreatedOrganization,
  CreatedPerson,
  CreatedUnit,
  CreatedUser,
} from "./types.js";
import { chunkedParallel, pickN, randomBoolean, randomInt } from "./utils.js";

const CHUNK_SIZE = 10;

/**
 * Seed games using chunked Promise.all.
 */
export async function seedGames(
  prisma: PrismaClient,
  total: number,
  users: CreatedUser[],
  people: CreatedPerson[],
  organizations: CreatedOrganization[],
  tags: CreatedUnit[],
): Promise<CreatedUnit[]> {
  console.log(`[Seed] Seeding ${total} games...`);

  return chunkedParallel(
    Array.from({ length: total }),
    CHUNK_SIZE,
    async () => {
      const author = faker.helpers.arrayElement(users);
      const translations = generateTranslations(UnitType.GAME);
      const platforms = pickN(
        [...PLATFORM_KEYS],
        randomInt(1, 4),
      );

      const unit = await prisma.unit.create({
        data: {
          type: UnitType.GAME,
          userId: author.unitId,
          status: randomBoolean(0.85) ? UnitStatus.PUBLISHED : UnitStatus.DRAFT,
          defaultLanguage: DEFAULT_LANGUAGE,
          publishedAt: randomBoolean(0.8) ? faker.date.past({ years: 5 }) : null,
          game: {
            create: {
              releaseDate: randomBoolean(0.7)
                ? faker.date.past({ years: 10 })
                : null,
              versionLabel: randomBoolean(0.5) ? `v${randomInt(1, 5)}.${randomInt(0, 9)}` : null,
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

      // Credits + tags
      const personCredits = pickN(people, randomInt(1, 3)).map(
        (p, i) => ({
          unitId: unit.id,
          personId: p.id,
          roleKey: faker.helpers.arrayElement(
            PERSON_ROLE_KEYS.filter((r) =>
              ["DIRECTOR", "COMPOSER", "ILLUSTRATOR"].includes(r),
            ),
          ),
          sortOrder: i,
        }),
      );

      const orgCredits = pickN(organizations, randomInt(1, 2)).map(
        (o, i) => ({
          unitId: unit.id,
          organizationId: o.id,
          roleKey: faker.helpers.arrayElement(
            ORG_ROLE_KEYS.filter((r) => ["STUDIO", "PUBLISHER"].includes(r)),
          ),
          sortOrder: i,
        }),
      );

      const tagLinks = pickN(tags, randomInt(1, 5)).map((t) => ({
        unitId: unit.id,
        tagUnitId: t.id,
      }));

      await Promise.all([
        personCredits.length > 0
          ? prisma.personCredit.createMany({ data: personCredits })
          : Promise.resolve(),
        orgCredits.length > 0
          ? prisma.orgCredit.createMany({ data: orgCredits })
          : Promise.resolve(),
        tagLinks.length > 0
          ? prisma.unitTag.createMany({ data: tagLinks })
          : Promise.resolve(),
      ]);

      return unit;
    },
  );
}
