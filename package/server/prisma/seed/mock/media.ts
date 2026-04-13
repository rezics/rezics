import { faker } from "@faker-js/faker";
import { DEFAULT_LANGUAGE } from "@rezics/contract";
import type { PrismaClient } from "#/prisma/generated/client.js";
import { UnitStatus, UnitType } from "#/prisma/generated/client.js";
import {
  MEDIA_KIND_KEYS,
  ORG_ROLE_KEYS,
  PERSON_ROLE_KEYS,
} from "./data.js";
import { generateMediaExtra, generateTranslation } from "./generators.js";
import type {
  CreatedOrganization,
  CreatedPerson,
  CreatedUnit,
  CreatedUser,
} from "./types.js";
import { chunkedParallel, pickN, randomBoolean, randomInt } from "./utils.js";

const CHUNK_SIZE = 10;

/**
 * Seed media using chunked Promise.all.
 */
export async function seedMedia(
  prisma: PrismaClient,
  total: number,
  users: CreatedUser[],
  people: CreatedPerson[],
  organizations: CreatedOrganization[],
  tags: CreatedUnit[],
): Promise<CreatedUnit[]> {
  console.log(`[Seed] Seeding ${total} media...`);

  return chunkedParallel(
    Array.from({ length: total }),
    CHUNK_SIZE,
    async () => {
      const author = faker.helpers.arrayElement(users);
      const translation = generateTranslation(UnitType.MEDIA);
      const kindKey = faker.helpers.arrayElement([...MEDIA_KIND_KEYS]);
      const isTV = kindKey === "TV_SERIES" || kindKey === "ANIME";

      const unit = await prisma.unit.create({
        data: {
          type: UnitType.MEDIA,
          userId: author.unitId,
          status: randomBoolean(0.85) ? UnitStatus.PUBLISHED : UnitStatus.DRAFT,
          defaultLanguage: DEFAULT_LANGUAGE,
          publishedAt: randomBoolean(0.8) ? faker.date.past({ years: 5 }) : null,
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
            create: {
              language: DEFAULT_LANGUAGE,
              title: translation.title,
              summary: translation.summary,
              description: translation.description,
            },
          },
          supportLanguages: {
            create: { language: DEFAULT_LANGUAGE, isPrimary: true },
          },
        },
        select: { id: true, type: true },
      });

      // Credits + tags
      const personCredits = pickN(people, randomInt(1, 4)).map(
        (p, i) => ({
          unitId: unit.id,
          personId: p.id,
          roleKey: faker.helpers.arrayElement(
            PERSON_ROLE_KEYS.filter((r) =>
              ["DIRECTOR", "ACTOR", "COMPOSER", "NARRATOR"].includes(r),
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
            ORG_ROLE_KEYS.filter((r) =>
              ["STUDIO", "DISTRIBUTOR"].includes(r),
            ),
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
