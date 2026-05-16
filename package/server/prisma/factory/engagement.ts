import { randomUUID } from "node:crypto";
import { DEFAULT_LANGUAGE } from "@rezics/contract";
import { UnitStatus, UnitType, UnitVisibility } from "../generated/client.js";
import { generateBetween } from "../../src/shelf/fractional-index";
import type { CountSpec, SeedCtx } from "./strategy.js";
import type { CreatedUnit, CreatedUser } from "./types.js";
import { pickN, unitTypeToShelfKind } from "./utils.js";

interface EngagementPlan {
  followsPerUser: CountSpec;
  favoriteItemsPerUser: CountSpec;
}

export async function seedEngagement(
  ctx: SeedCtx,
  plan: EngagementPlan,
  users: CreatedUser[],
  allUnits: CreatedUnit[],
): Promise<void> {
  console.log(
    `[Seed] Seeding engagement for ${allUnits.length} units, ${users.length} users...`,
  );

  try {
    await seedFavorites(ctx, plan.favoriteItemsPerUser, users, allUnits);
  } catch (err) {
    console.error("[Error] seedFavorites failed:", err);
    throw err;
  }
  try {
    await seedFollows(ctx, plan.followsPerUser, users);
  } catch (err) {
    console.error("[Error] seedFollows failed:", err);
    throw err;
  }
}

async function seedFavorites(
  ctx: SeedCtx,
  spec: CountSpec,
  users: CreatedUser[],
  units: CreatedUnit[],
): Promise<void> {
  console.log(`[Seed]   Seeding favorites shelves...`);

  for (const user of users) {
    const favCount = ctx.draw(spec);
    if (favCount === 0) continue;

    const targets = pickN(units, Math.min(favCount, units.length));
    const shelfId = randomUUID();

    await ctx.prisma.unit.create({
      data: {
        id: shelfId,
        type: UnitType.SHELF,
        userId: user.userId,
        slugScope: user.userId,
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
    const shelfUnitRows = unique.map((target) => {
      const position = generateBetween(prevPos, undefined);
      prevPos = position;
      return {
        shelfId,
        unitId: target.id,
        kind: unitTypeToShelfKind(target.type),
        position,
      };
    });

    if (shelfUnitRows.length > 0) {
      await ctx.prisma.shelfUnit.createMany({
        data: shelfUnitRows,
        skipDuplicates: true,
      });
      await ctx.prisma.shelf.update({
        where: { unitId: shelfId },
        data: { itemCount: shelfUnitRows.length },
      });
    }
  }
}

async function seedFollows(
  ctx: SeedCtx,
  spec: CountSpec,
  users: CreatedUser[],
): Promise<void> {
  console.log(`[Seed]   Seeding follows (USER→USER subscriptions)...`);

  const seen = new Set<string>();
  const data: {
    id: string;
    subscriberUnitId: string;
    targetUnitId: string;
    channels: string[];
  }[] = [];

  for (const user of users) {
    const followCount = ctx.draw(spec);
    const targets = pickN(
      users.filter((u) => u.userId !== user.userId),
      Math.min(followCount, users.length - 1),
    );
    for (const target of targets) {
      const key = `${user.userId}:${target.userId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      data.push({
        id: randomUUID(),
        subscriberUnitId: user.userId,
        targetUnitId: target.userId,
        channels: ["*"],
      });
    }
  }

  const BATCH_SIZE = 5000;
  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    await ctx.prisma.subscription.createMany({
      data: data.slice(i, i + BATCH_SIZE),
      skipDuplicates: true,
    });
  }

  const followerCounts = new Map<string, number>();
  const followingCounts = new Map<string, number>();
  const subscriberCounts = new Map<string, number>();
  for (const f of data) {
    followerCounts.set(
      f.targetUnitId,
      (followerCounts.get(f.targetUnitId) ?? 0) + 1,
    );
    followingCounts.set(
      f.subscriberUnitId,
      (followingCounts.get(f.subscriberUnitId) ?? 0) + 1,
    );
    subscriberCounts.set(
      f.targetUnitId,
      (subscriberCounts.get(f.targetUnitId) ?? 0) + 1,
    );
  }

  const usersToUpdate = users.filter((user) => {
    const fc = followerCounts.get(user.userId);
    const gc = followingCounts.get(user.userId);
    return Boolean(fc || gc);
  });

  const UPDATE_BATCH = 50;
  for (let i = 0; i < usersToUpdate.length; i += UPDATE_BATCH) {
    const slice = usersToUpdate.slice(i, i + UPDATE_BATCH);
    await Promise.all(
      slice.map((user) =>
        ctx.prisma.user.update({
          where: { unitId: user.userId },
          data: {
            followersCount: followerCounts.get(user.userId) ?? 0,
            followingsCount: followingCounts.get(user.userId) ?? 0,
          },
        }),
      ),
    );
  }

  // Bump Unit.subscriberCount for every USER unit that gained followers
  // so the denormalized counter aligns with the seeded subscriptions.
  const unitsToBump = Array.from(subscriberCounts.entries()).filter(
    ([, n]) => n > 0,
  );
  for (let i = 0; i < unitsToBump.length; i += UPDATE_BATCH) {
    const slice = unitsToBump.slice(i, i + UPDATE_BATCH);
    await Promise.all(
      slice.map(([unitId, n]) =>
        ctx.prisma.unit.update({
          where: { id: unitId },
          data: { subscriberCount: n },
        }),
      ),
    );
  }
}
