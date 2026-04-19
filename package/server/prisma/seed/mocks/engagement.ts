import { randomUUID } from "node:crypto";
import { DEFAULT_LANGUAGE } from "@rezics/contract";
import type { PrismaClient } from "#/prisma/generated/client.js";
import {
  UnitStatus,
  UnitType,
  UnitVisibility,
} from "#/prisma/generated/client.js";
import { generateBetween } from "@/shelf/fractional-index";
import type { CreatedUnit, CreatedUser } from "./types.js";
import { pickN, randomInt, unitTypeToShelfKind } from "./utils.js";

/**
 * Seed all engagement data: reaction summaries, favorites, follows.
 * Substeps run in parallel.
 */
export async function seedEngagement(
  prisma: PrismaClient,
  users: CreatedUser[],
  allUnits: CreatedUnit[],
  counts: { followsPerUser: number; favoriteItemsPerUser: number },
): Promise<void> {
  console.log(
    `[Seed] Seeding engagement for ${allUnits.length} units, ${users.length} users...`,
  );

  try {
    await seedFavorites(prisma, users, allUnits, counts.favoriteItemsPerUser);
  } catch (err) {
    console.error("[Error] seedFavorites failed:", err);
    throw err;
  }
  try {
    await seedFollows(prisma, users, counts.followsPerUser);
  } catch (err) {
    console.error("[Error] seedFollows failed:", err);
    throw err;
  }
}

/**
 * Create a Favorites shelf for each user and add random items.
 * Dual-writes ShelfItem + ShelfUnit(role='primary') per slot.
 */
async function seedFavorites(
  prisma: PrismaClient,
  users: CreatedUser[],
  units: CreatedUnit[],
  perUser: number,
): Promise<void> {
  console.log(`[Seed]   Seeding favorites shelves...`);

  for (const user of users) {
    const favCount = randomInt(0, perUser);
    if (favCount === 0) continue;

    const targets = pickN(units, Math.min(favCount, units.length));
    const shelfId = randomUUID();

    await prisma.unit.create({
      data: {
        id: shelfId,
        type: UnitType.SHELF,
        userId: user.unitId,
        status: UnitStatus.PUBLISHED,
        visibility: UnitVisibility.PRIVATE,
        publishedAt: new Date(),
        shelf: { create: { kindKey: "favorites" } },
        translations: {
          create: { language: DEFAULT_LANGUAGE, title: "Favorites" },
        },
      },
    });

    const seen = new Set<string>();
    const unique = targets.filter((t) => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });

    let prevPos: string | undefined;
    const shelfItemRows = unique.map((target) => {
      const position = generateBetween(prevPos, undefined);
      prevPos = position;
      return {
        shelfUnitId: shelfId,
        itemRef: target.id,
        kind: unitTypeToShelfKind(target.type),
        position,
      };
    });
    const shelfUnitRows = unique.map((target) => ({
      shelfUnitId: shelfId,
      itemRef: target.id,
      unitId: target.id,
      role: "primary",
    }));

    if (shelfItemRows.length > 0) {
      await prisma.shelfItem.createMany({
        data: shelfItemRows,
        skipDuplicates: true,
      });
      await prisma.shelfUnit.createMany({
        data: shelfUnitRows,
        skipDuplicates: true,
      });
    }
  }
}

/**
 * Create Follow rows (random user→user pairs).
 */
async function seedFollows(
  prisma: PrismaClient,
  users: CreatedUser[],
  perUser: number,
): Promise<void> {
  console.log(`[Seed]   Seeding follows...`);

  const seen = new Set<string>();
  const data: { id: string; followerId: string; followingId: string }[] = [];

  for (const user of users) {
    const followCount = randomInt(0, perUser);
    const targets = pickN(
      users.filter((u) => u.unitId !== user.unitId),
      Math.min(followCount, users.length - 1),
    );
    for (const target of targets) {
      const key = `${user.unitId}:${target.unitId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      data.push({
        id: randomUUID(),
        followerId: user.unitId,
        followingId: target.unitId,
      });
    }
  }

  const BATCH_SIZE = 5000;
  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    await prisma.follow.createMany({
      data: data.slice(i, i + BATCH_SIZE),
      skipDuplicates: true,
    });
  }

  // Update follower/following counts
  const followerCounts = new Map<string, number>();
  const followingCounts = new Map<string, number>();
  for (const f of data) {
    followerCounts.set(
      f.followingId,
      (followerCounts.get(f.followingId) ?? 0) + 1,
    );
    followingCounts.set(
      f.followerId,
      (followingCounts.get(f.followerId) ?? 0) + 1,
    );
  }

  const usersToUpdate = users.filter((user) => {
    const fc = followerCounts.get(user.unitId);
    const gc = followingCounts.get(user.unitId);
    return Boolean(fc || gc);
  });

  const UPDATE_BATCH = 50;
  for (let i = 0; i < usersToUpdate.length; i += UPDATE_BATCH) {
    const slice = usersToUpdate.slice(i, i + UPDATE_BATCH);
    await Promise.all(
      slice.map((user) =>
        prisma.user.update({
          where: { unitId: user.unitId },
          data: {
            followersCount: followerCounts.get(user.unitId) ?? 0,
            followingsCount: followingCounts.get(user.unitId) ?? 0,
          },
        }),
      ),
    );
  }
}
