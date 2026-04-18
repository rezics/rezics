import { randomUUID } from "node:crypto";
import { DEFAULT_LANGUAGE } from "@rezics/contract";
import type { PrismaClient } from "#/prisma/generated/client.js";
import {
  UnitStatus,
  UnitType,
  UnitVisibility,
} from "#/prisma/generated/client.js";
import { generateBetween } from "@/shelf/fractional-index";
import type { CreatedUser } from "./types.js";
import { pickN, randomInt } from "./utils.js";

/**
 * Seed all engagement data: reaction summaries, favorites, follows.
 * Substeps run in parallel.
 */
export async function seedEngagement(
  prisma: PrismaClient,
  users: CreatedUser[],
  allUnitIds: string[],
  counts: { followsPerUser: number; bookmarksPerUser: number },
): Promise<void> {
  console.log(
    `[Seed] Seeding engagement for ${allUnitIds.length} units, ${users.length} users...`,
  );

  await Promise.all([
    seedFavorites(prisma, users, allUnitIds, counts.bookmarksPerUser),
    seedFollows(prisma, users, counts.followsPerUser),
  ]);
}

/**
 * Create a Favorites shelf for each user and add random items.
 */
async function seedFavorites(
  prisma: PrismaClient,
  users: CreatedUser[],
  unitIds: string[],
  perUser: number,
): Promise<void> {
  console.log(`[Seed]   Seeding favorites shelves...`);

  for (const user of users) {
    const favCount = randomInt(0, perUser);
    if (favCount === 0) continue;

    const targets = pickN(unitIds, Math.min(favCount, unitIds.length));
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
    const unique = targets.filter((targetId) => {
      if (seen.has(targetId)) return false;
      seen.add(targetId);
      return true;
    });
    let prevPos: string | undefined;
    const items = unique.map((targetId) => {
      const position = generateBetween(prevPos, undefined);
      prevPos = position;
      return {
        shelfUnitId: shelfId,
        itemRef: targetId,
        kind: "book",
        position,
        reviewIds: [] as string[],
        tagIds: [] as string[],
      };
    });

    if (items.length > 0) {
      await prisma.shelfItem.createMany({ data: items, skipDuplicates: true });
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

  const userUpdates: Promise<unknown>[] = [];
  for (const user of users) {
    const fc = followerCounts.get(user.unitId);
    const gc = followingCounts.get(user.unitId);
    if (fc || gc) {
      userUpdates.push(
        prisma.user.update({
          where: { unitId: user.unitId },
          data: {
            followersCount: fc ?? 0,
            followingsCount: gc ?? 0,
          },
        }),
      );
    }
  }

  // Batch the updates
  const UPDATE_BATCH = 50;
  for (let i = 0; i < userUpdates.length; i += UPDATE_BATCH) {
    await Promise.all(userUpdates.slice(i, i + UPDATE_BATCH));
  }
}
