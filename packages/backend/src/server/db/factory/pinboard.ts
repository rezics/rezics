import { Pinboard, PinboardEntry } from "../schema";
import { generateBetween } from "../../shelf/fractional-index";
import type { SeedCtx } from "./strategy.js";
import type { CreatedPost, CreatedUnit } from "./types.js";
import { pickN, randomInt } from "./utils.js";

/**
 * Populate first-class home Pinboards with post Unit references. Pinboard
 * entries own ordering; entry rendering stays with the consuming app surface.
 */
export async function seedPinboard(
  ctx: SeedCtx,
  realms: CreatedUnit[],
  posts: CreatedPost[],
): Promise<void> {
  if (realms.length === 0 || posts.length === 0) return;

  console.log(`[Seed] Pinning ${realms.length} realms via Pinboard tables...`);

  const postIds = posts.map((p) => p.id);

  for (const realm of realms) {
    const pinCount = Math.min(randomInt(2, 6), postIds.length);
    const pinned = pickN(postIds, pinCount);
    const [pinboard] = await ctx.db
      .insert(Pinboard)
      .values({ realmUnitId: realm.id, key: "home", kind: "list" })
      .onConflictDoUpdate({
        target: [Pinboard.realmUnitId, Pinboard.key],
        set: { kind: "list", updatedAt: new Date() },
      })
      .returning();
    if (!pinboard) continue;

    let previous: string | undefined;
    for (const unitId of pinned) {
      const position = generateBetween(previous, undefined);
      previous = position;
      await ctx.db
        .insert(PinboardEntry)
        .values({ pinboardId: pinboard.id, unitId, position })
        .onConflictDoNothing();
    }
  }
}
