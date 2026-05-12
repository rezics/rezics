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
    const shelfItemUnitRows = unique.map((target) => ({
      shelfUnitId: shelfId,
      itemRef: target.id,
      unitId: target.id,
      role: "primary",
    }));

    if (shelfItemRows.length > 0) {
      await ctx.prisma.shelfItem.createMany({
        data: shelfItemRows,
        skipDuplicates: true,
      });
      await ctx.prisma.shelfItemUnit.createMany({
        data: shelfItemUnitRows,
        skipDuplicates: true,
      });
    }
  }
}

async function seedFollows(
  ctx: SeedCtx,
  spec: CountSpec,
  users: CreatedUser[],
): Promise<void> {
  console.log(`[Seed]   Seeding follows...`);

  const seen = new Set<string>();
  const data: { id: string; followerId: string; followingId: string }[] = [];

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
        followerId: user.userId,
        followingId: target.userId,
      });
    }
  }

  const BATCH_SIZE = 5000;
  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    await ctx.prisma.follow.createMany({
      data: data.slice(i, i + BATCH_SIZE),
      skipDuplicates: true,
    });
  }

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
          where: { userId: user.userId },
          data: {
            followersCount: followerCounts.get(user.userId) ?? 0,
            followingsCount: followingCounts.get(user.userId) ?? 0,
          },
        }),
      ),
    );
  }
}
