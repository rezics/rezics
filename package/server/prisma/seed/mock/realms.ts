import { faker } from "@faker-js/faker";
import type { PrismaClient } from "#/prisma/generated/client.js";
import { UnitStatus, UnitType } from "#/prisma/generated/client.js";
import { REALM_ROLE_KEYS } from "./data.js";
import { generateTranslation } from "./generators.js";
import type { CreatedUnit, CreatedUser } from "./types.js";
import { chunkedParallel, pickN, randomBoolean, randomInt } from "./utils.js";

const CHUNK_SIZE = 10;

/**
 * Seed realms.
 * Each realm = Unit(type=REALM) + Realm extension + UnitTranslation + RealmMembers + RealmUnits.
 */
export async function seedRealms(
  prisma: PrismaClient,
  total: number,
  users: CreatedUser[],
  workIds: string[],
): Promise<CreatedUnit[]> {
  console.log(`[Seed] Seeding ${total} realms...`);

  return chunkedParallel(
    Array.from({ length: total }),
    CHUNK_SIZE,
    async () => {
      const owner = faker.helpers.arrayElement(users);
      const translation = generateTranslation(UnitType.REALM);
      const isPublic = randomBoolean(0.8);

      const unit = await prisma.unit.create({
        data: {
          type: UnitType.REALM,
          userId: owner.unitId,
          status: UnitStatus.PUBLISHED,
          defaultLanguage: "en",
          publishedAt: faker.date.past({ years: 2 }),
          realm: {
            create: {
              isPublic,
              isOfficial: false,
            },
          },
          translations: {
            create: {
              language: "en",
              title: translation.title,
              description: translation.description,
            },
          },
          supportLanguages: {
            create: { language: "en", isPrimary: true },
          },
        },
        select: { id: true, type: true },
      });

      // Add members (owner + random members)
      const memberCount = randomInt(3, 20);
      const memberUsers = pickN(
        users.filter((u) => u.unitId !== owner.unitId),
        Math.min(memberCount, users.length - 1),
      );

      const members = [
        {
          realmUnitId: unit.id,
          userId: owner.unitId,
          roleKey: "OWNER",
        },
        ...memberUsers.map((u) => ({
          realmUnitId: unit.id,
          userId: u.unitId,
          roleKey: faker.helpers.arrayElement(
            REALM_ROLE_KEYS.filter((r) => r !== "OWNER"),
          ),
        })),
      ];

      await prisma.realmMember.createMany({ data: members });

      // Update member count
      await prisma.realm.update({
        where: { unitId: unit.id },
        data: { memberCount: members.length },
      });

      // Add some works to the realm
      if (workIds.length > 0) {
        const realmWorkCount = randomInt(2, Math.min(15, workIds.length));
        const selectedWorks = pickN(workIds, realmWorkCount);
        await prisma.realmUnit.createMany({
          data: selectedWorks.map((workId) => ({
            realmUnitId: unit.id,
            unitId: workId,
          })),
        });
      }

      return unit;
    },
  );
}
