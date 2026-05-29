import type { BlockedUser } from "@rezics/contract";
import { prisma } from "#/prisma/client";
import { requireSlugScopeId } from "@/infra/slug-scopes";
import { mapBlockedUser } from "./mapper";

/**
 * User-to-user blocking. A block is directional (`blockerId` blocked
 * `blockedId`); enforcement that should apply both ways (DM) uses
 * `isBlockedEitherWay`. Content hiding uses `blockedUserIds` (the ids the
 * viewer has blocked).
 */
export class BlockService {
  /** The blocker's blocked users, enriched with public brief + block time. */
  async listBlocked(blockerId: string): Promise<BlockedUser[]> {
    const blocks = await prisma.userBlock.findMany({
      where: { blockerId },
      orderBy: { createdAt: "desc" },
    });
    if (blocks.length === 0) return [];

    const ids = blocks.map((b) => b.blockedId);
    const userScope = requireSlugScopeId("user");
    const [users, units] = await Promise.all([
      prisma.user.findMany({
        where: { unitId: { in: ids } },
        select: { unitId: true, name: true, bio: true, avatar: true },
      }),
      prisma.unit.findMany({
        where: { id: { in: ids }, slugScope: userScope, type: "USER" },
        select: { id: true, slug: true },
      }),
    ]);
    const userMap = new Map(users.map((u) => [u.unitId, u] as const));
    const slugMap = new Map(units.map((u) => [u.id, u.slug ?? null] as const));

    return blocks.map((block) =>
      mapBlockedUser(
        block,
        userMap.get(block.blockedId),
        slugMap.get(block.blockedId) ?? null,
      ),
    );
  }

  /** Idempotently record that `blockerId` blocks `blockedId`. */
  async add(blockerId: string, blockedId: string): Promise<void> {
    await prisma.userBlock.upsert({
      where: { blockerId_blockedId: { blockerId, blockedId } },
      update: {},
      create: { blockerId, blockedId },
    });
  }

  /** Remove the block from `blockerId` to `blockedId` (no-op if absent). */
  async remove(blockerId: string, blockedId: string): Promise<void> {
    await prisma.userBlock.deleteMany({ where: { blockerId, blockedId } });
  }

  /** unitIds the blocker has blocked — used to hide content in feeds. */
  async blockedUserIds(blockerId: string): Promise<string[]> {
    const rows = await prisma.userBlock.findMany({
      where: { blockerId },
      select: { blockedId: true },
    });
    return rows.map((r) => r.blockedId);
  }

  /** True if either user has blocked the other — used to gate DM. */
  async isBlockedEitherWay(a: string, b: string): Promise<boolean> {
    const row = await prisma.userBlock.findFirst({
      where: {
        OR: [
          { blockerId: a, blockedId: b },
          { blockerId: b, blockedId: a },
        ],
      },
      select: { id: true },
    });
    return row !== null;
  }

  /** Remove every block row referencing the user (either side). */
  async removeAllForUser(userId: string): Promise<void> {
    await prisma.userBlock.deleteMany({
      where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    });
  }
}

export const blockService = new BlockService();
