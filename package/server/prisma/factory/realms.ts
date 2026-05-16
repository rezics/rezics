import { faker } from "@faker-js/faker";
import { DEFAULT_LANGUAGE } from "@rezics/contract";
import { UnitStatus, UnitType } from "../generated/client.js";
import { REALM_ROLE_KEYS } from "./data.js";
import { generateTranslations } from "./generators.js";
import type { CountSpec, SeedCtx } from "./strategy.js";
import type { CreatedUnit, CreatedUser } from "./types.js";
import { chunkedParallel, pickN, randomBoolean, randomInt } from "./utils.js";

const CHUNK_SIZE = 10;

export async function seedRealms(
  ctx: SeedCtx,
  spec: CountSpec,
  users: CreatedUser[],
  workIds: string[],
): Promise<CreatedUnit[]> {
  const total = ctx.draw(spec);
  console.log(`[Seed] Seeding ${total} realms...`);

  return chunkedParallel(
    Array.from({ length: total }),
    CHUNK_SIZE,
    async () => {
      const owner = faker.helpers.arrayElement(users);
      const translations = generateTranslations(UnitType.REALM);
      const isPublic = randomBoolean(0.8);

      const unit = await ctx.prisma.unit.create({
        data: {
          type: UnitType.REALM,
          userId: owner.userId,
          slugScope: ctx.slugScopes.realm,
          status: UnitStatus.PUBLISHED,
          defaultLanguage: DEFAULT_LANGUAGE,
          publishedAt: faker.date.past({ years: 2 }),
          realm: {
            create: {
              isPublic,
              isOfficial: false,
            },
          },
          translations: {
            create: translations.map((t) => ({
              language: t.language,
              title: t.title,
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

      const memberCount = randomInt(3, 20);
      const memberUsers = pickN(
        users.filter((u) => u.userId !== owner.userId),
        Math.min(memberCount, users.length - 1),
      );

      const members = [
        {
          realmUnitId: unit.id,
          userId: owner.userId,
          roleKey: "owner",
        },
        ...memberUsers.map((u) => ({
          realmUnitId: unit.id,
          userId: u.userId,
          roleKey: faker.helpers.arrayElement(
            REALM_ROLE_KEYS.filter((r) => r !== "owner"),
          ),
        })),
      ];

      await ctx.prisma.realmMember.createMany({ data: members });

      await ctx.prisma.realm.update({
        where: { unitId: unit.id },
        data: { memberCount: members.length },
      });

      if (workIds.length > 0) {
        const realmWorkCount = randomInt(2, Math.min(15, workIds.length));
        const selectedWorks = pickN(workIds, realmWorkCount);
        await ctx.prisma.realmUnit.createMany({
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
