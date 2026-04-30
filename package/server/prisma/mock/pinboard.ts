import { Prisma } from "../generated/client.js";
import type { SeedCtx } from "./strategy.js";
import type { CreatedPost, CreatedUnit } from "./types.js";
import { pickN, randomInt } from "./utils.js";

/**
 * Populate `Realm.extra.pinboard` (and, for the first realm, also
 * `Realm.extra.announcement`) with post IDs. The realm-extra primitives read
 * straight off this JSON column — the seed doesn't go through any service
 * layer, just sets the JSON shape the contract expects.
 */
export async function seedPinboard(
  ctx: SeedCtx,
  realms: CreatedUnit[],
  posts: CreatedPost[],
): Promise<void> {
  if (realms.length === 0 || posts.length === 0) return;

  console.log(
    `[Seed] Pinning ${realms.length} realms via Realm.extra primitives...`,
  );

  const postIds = posts.map((p) => p.id);

  for (const [index, realm] of realms.entries()) {
    const pinCount = Math.min(randomInt(2, 6), postIds.length);
    const pinned = pickN(postIds, pinCount);
    const extra: Record<string, unknown> = { pinboard: pinned };

    if (index === 0) {
      const announcementCount = Math.min(randomInt(1, 3), postIds.length);
      extra.announcement = pickN(postIds, announcementCount);
    }

    await ctx.prisma.realm.update({
      where: { unitId: realm.id },
      data: { extra: extra as Prisma.InputJsonValue },
    });
  }
}
