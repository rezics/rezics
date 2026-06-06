import { randomUUID } from "node:crypto";
import {
  DEFAULT_LANGUAGE,
  DEFAULT_PUBLICATION_LICENSE_SLUG,
} from "@rezics/contract";
import { eq } from "drizzle-orm";
import { generateBetween } from "../../shelf/fractional-index";
import {
  Shelf,
  ShelfItem,
  Subscription,
  Unit,
  UnitTranslation,
  User,
} from "../schema";
import { UnitStatus, UnitType, UnitVisibility } from "./storage-values.js";
import type { CountSpec, SeedCtx } from "./strategy.js";
import type { CreatedUnit, CreatedUser } from "./types.js";
import { pickN, unitTypeToShelfKind, withUpdatedAt } from "./utils.js";

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

    await ctx.db.insert(Unit).values(
      withUpdatedAt({
        id: shelfId,
        type: UnitType.SHELF,
        userId: user.userId,
        slugScope: user.userId,
        status: UnitStatus.PUBLISHED,
        visibility: UnitVisibility.PRIVATE,
        licenseSlug: DEFAULT_PUBLICATION_LICENSE_SLUG,
        publishedAt: new Date(),
      }),
    );
    await ctx.db.insert(Shelf).values(
      withUpdatedAt({
        unitId: shelfId,
        kindKey: "favorites",
      }),
    );
    await ctx.db.insert(UnitTranslation).values(
      withUpdatedAt({
        unitId: shelfId,
        language: DEFAULT_LANGUAGE,
        title: "Favorites",
      }),
    );

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
        shelfId,
        itemType: "unit",
        itemId: target.id,
        kind: unitTypeToShelfKind(target.type),
        position,
        updatedAt: new Date(),
      };
    });

    if (shelfItemRows.length > 0) {
      await ctx.db
        .insert(ShelfItem)
        .values(shelfItemRows)
        .onConflictDoNothing();
      await ctx.db
        .update(Shelf)
        .set({ itemCount: shelfItemRows.length })
        .where(eq(Shelf.unitId, shelfId));
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
    subscribedUnitId: string;
    channels: string[];
    updatedAt: Date;
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
        subscribedUnitId: target.userId,
        channels: ["*"],
        updatedAt: new Date(),
      });
    }
  }

  const BATCH_SIZE = 5000;
  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data.slice(i, i + BATCH_SIZE);
    if (batch.length === 0) continue;
    await ctx.db.insert(Subscription).values(batch).onConflictDoNothing();
  }

  const followerCounts = new Map<string, number>();
  const followingCounts = new Map<string, number>();
  const subscriberCounts = new Map<string, number>();
  for (const f of data) {
    followerCounts.set(
      f.subscribedUnitId,
      (followerCounts.get(f.subscribedUnitId) ?? 0) + 1,
    );
    followingCounts.set(
      f.subscriberUnitId,
      (followingCounts.get(f.subscriberUnitId) ?? 0) + 1,
    );
    subscriberCounts.set(
      f.subscribedUnitId,
      (subscriberCounts.get(f.subscribedUnitId) ?? 0) + 1,
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
        ctx.db
          .update(User)
          .set({
            followersCount: followerCounts.get(user.userId) ?? 0,
            followingsCount: followingCounts.get(user.userId) ?? 0,
          })
          .where(eq(User.unitId, user.userId)),
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
        ctx.db
          .update(Unit)
          .set({ subscriberCount: n })
          .where(eq(Unit.id, unitId)),
      ),
    );
  }
}
