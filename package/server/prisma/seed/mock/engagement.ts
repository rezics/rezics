import { randomUUID } from "node:crypto";
import { faker } from "@faker-js/faker";
import type { PrismaClient } from "#/prisma/generated/client.js";
import { REACTION_TYPES } from "./data.js";
import type { CreatedUser } from "./types.js";
import { pickN, randomInt } from "./utils.js";

/**
 * Seed all engagement data: reaction summaries, bookmarks, ratings, follows.
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
    seedReactionSummaries(prisma, allUnitIds),
    seedBookmarks(prisma, users, allUnitIds, counts.bookmarksPerUser),
    seedFollows(prisma, users, counts.followsPerUser),
  ]);
}

/**
 * Create ReactionSummary rows for all units (like/dislike/love).
 */
async function seedReactionSummaries(
  prisma: PrismaClient,
  unitIds: string[],
): Promise<void> {
  console.log(`[Seed]   Seeding reaction summaries...`);

  const data = unitIds.flatMap((targetId) =>
    REACTION_TYPES.map((reaction) => ({
      targetId,
      reaction,
      count: randomInt(0, 300),
    })),
  );

  // createMany in batches to avoid parameter limit
  const BATCH_SIZE = 5000;
  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    await prisma.reactionSummary.createMany({
      data: data.slice(i, i + BATCH_SIZE),
    });
  }
}

/**
 * Create Bookmark rows (random user→unit pairs).
 */
async function seedBookmarks(
  prisma: PrismaClient,
  users: CreatedUser[],
  unitIds: string[],
  perUser: number,
): Promise<void> {
  console.log(`[Seed]   Seeding bookmarks...`);

  const seen = new Set<string>();
  const data: { userId: string; targetId: string }[] = [];

  for (const user of users) {
    const bookmarkCount = randomInt(0, perUser);
    const targets = pickN(unitIds, Math.min(bookmarkCount, unitIds.length));
    for (const targetId of targets) {
      const key = `${user.unitId}:${targetId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      data.push({ userId: user.unitId, targetId });
    }
  }

  const BATCH_SIZE = 5000;
  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    await prisma.bookmark.createMany({
      data: data.slice(i, i + BATCH_SIZE),
      skipDuplicates: true,
    });
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
    followerCounts.set(f.followingId, (followerCounts.get(f.followingId) ?? 0) + 1);
    followingCounts.set(f.followerId, (followingCounts.get(f.followerId) ?? 0) + 1);
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
