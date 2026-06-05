import { randomUUID } from "node:crypto";
import { faker } from "@faker-js/faker";
import {
  DEFAULT_LANGUAGE,
  DEFAULT_PUBLICATION_LICENSE_SLUG,
} from "@rezics/contract";
import {
  Realm,
  RealmMember,
  Unit,
  UnitRealm,
  UnitSupportLanguage,
  UnitTranslation,
} from "../schema";
import { REALM_ROLE_KEYS } from "./data.js";
import { generateTranslations } from "./generators.js";
import { UnitStatus, UnitType } from "./storage-values.js";
import type { CountSpec, SeedCtx } from "./strategy.js";
import type { CreatedUnit, CreatedUser } from "./types.js";
import {
  chunkedParallel,
  pickN,
  randomBoolean,
  randomInt,
  withUpdatedAt,
  withUpdatedAtRows,
} from "./utils.js";

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

      const unit = { id: randomUUID(), type: UnitType.REALM };

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

      await ctx.db.insert(Unit).values(
        withUpdatedAt({
          id: unit.id,
          type: UnitType.REALM,
          userId: owner.userId,
          slugScope: ctx.slugScopes.realm,
          status: UnitStatus.PUBLISHED,
          defaultLanguage: DEFAULT_LANGUAGE,
          publishedAt: faker.date.past({ years: 2 }),
        }),
      );
      await ctx.db.insert(Realm).values(
        withUpdatedAt({
          unitId: unit.id,
          isPublic,
          isOfficial: false,
          memberCount: members.length,
          extra: {
            defaultLicenseSlug: DEFAULT_PUBLICATION_LICENSE_SLUG,
          },
        }),
      );
      await ctx.db.insert(UnitTranslation).values(
        withUpdatedAtRows(
          translations.map((t) => ({
            unitId: unit.id,
            language: t.language,
            title: t.title,
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
            sortOrder: i,
          })),
        ),
      );
      await ctx.db.insert(RealmMember).values(withUpdatedAtRows(members));

      if (workIds.length > 0) {
        const realmWorkCount = randomInt(2, Math.min(15, workIds.length));
        const selectedWorks = pickN(workIds, realmWorkCount);
        await ctx.db.insert(UnitRealm).values(
          withUpdatedAtRows(
            selectedWorks.map((workId) => ({
              realmUnitId: unit.id,
              unitId: workId,
            })),
          ),
        );
      }

      await ctx.sync.realm(unit.id);

      return unit;
    },
  );
}
