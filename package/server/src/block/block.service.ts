import type { BlockedUser } from "@rezics/contract";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import { Unit, User, UserBlock } from "../db/schema";
import { mapBlockedUser } from "./mapper";

type BlockRow = typeof UserBlock.$inferSelect;
type UserBriefRow = Pick<
  typeof User.$inferSelect,
  "unitId" | "name" | "bio" | "avatar"
>;
type UnitSlugRow = Pick<typeof Unit.$inferSelect, "id" | "slug">;

type BlockRepository = {
  listBlocks(blockerId: string): Promise<BlockRow[]>;
  listUsers(ids: readonly string[]): Promise<UserBriefRow[]>;
  listUserSlugs(input: {
    ids: readonly string[];
    userScope: string;
  }): Promise<UnitSlugRow[]>;
  add(blockerId: string, blockedId: string): Promise<void>;
  remove(blockerId: string, blockedId: string): Promise<void>;
  blockedUserIds(blockerId: string): Promise<string[]>;
  isBlockedEitherWay(a: string, b: string): Promise<boolean>;
  removeAllForUser(userId: string): Promise<void>;
};

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

function createDrizzleBlockRepository(): BlockRepository {
  return {
    async listBlocks(blockerId) {
      const db = await getServerDb();
      return db
        .select()
        .from(UserBlock)
        .where(eq(UserBlock.blockerId, blockerId))
        .orderBy(desc(UserBlock.createdAt));
    },

    async listUsers(ids) {
      if (ids.length === 0) return [];
      const db = await getServerDb();
      return db
        .select({
          unitId: User.unitId,
          name: User.name,
          bio: User.bio,
          avatar: User.avatar,
        })
        .from(User)
        .where(inArray(User.unitId, [...ids]));
    },

    async listUserSlugs(input) {
      if (input.ids.length === 0) return [];
      const db = await getServerDb();
      return db
        .select({
          id: Unit.id,
          slug: Unit.slug,
        })
        .from(Unit)
        .where(
          and(
            inArray(Unit.id, [...input.ids]),
            eq(Unit.slugScope, input.userScope),
            eq(Unit.type, "USER"),
          ),
        );
    },

    async add(blockerId, blockedId) {
      const db = await getServerDb();
      await db
        .insert(UserBlock)
        .values({ blockerId, blockedId })
        .onConflictDoNothing({
          target: [UserBlock.blockerId, UserBlock.blockedId],
        });
    },

    async remove(blockerId, blockedId) {
      const db = await getServerDb();
      await db
        .delete(UserBlock)
        .where(
          and(
            eq(UserBlock.blockerId, blockerId),
            eq(UserBlock.blockedId, blockedId),
          ),
        );
    },

    async blockedUserIds(blockerId) {
      const db = await getServerDb();
      const rows = await db
        .select({ blockedId: UserBlock.blockedId })
        .from(UserBlock)
        .where(eq(UserBlock.blockerId, blockerId));
      return rows.map((row) => row.blockedId);
    },

    async isBlockedEitherWay(a, b) {
      const db = await getServerDb();
      const [row] = await db
        .select({ id: UserBlock.id })
        .from(UserBlock)
        .where(
          or(
            and(eq(UserBlock.blockerId, a), eq(UserBlock.blockedId, b)),
            and(eq(UserBlock.blockerId, b), eq(UserBlock.blockedId, a)),
          ),
        )
        .limit(1);
      return Boolean(row);
    },

    async removeAllForUser(userId) {
      const db = await getServerDb();
      await db
        .delete(UserBlock)
        .where(
          or(eq(UserBlock.blockerId, userId), eq(UserBlock.blockedId, userId)),
        );
    },
  };
}

/**
 * User-to-user blocking. A block is directional (`blockerId` blocked
 * `blockedId`); enforcement that should apply both ways (DM) uses
 * `isBlockedEitherWay`. Content hiding uses `blockedUserIds` (the ids the
 * viewer has blocked).
 * 用户对用户的拉黑。拉黑是有方向的（`blockerId` 拉黑了 `blockedId`）；需要双向
 * 生效的约束（如私信 DM）使用 `isBlockedEitherWay`。内容隐藏使用
 * `blockedUserIds`（观看者已拉黑的 id 集合）。
 */
export class BlockService {
  constructor(private readonly repository = createDrizzleBlockRepository()) {}

  /** The blocker's blocked users, enriched with public brief + block time. 拉黑者所拉黑的用户，附带公开简介与拉黑时间。 */
  async listBlocked(blockerId: string): Promise<BlockedUser[]> {
    const blocks = await this.repository.listBlocks(blockerId);
    if (blocks.length === 0) return [];

    const ids = blocks.map((b) => b.blockedId);
    const { requireSlugScopeId } = await import("../infra/slug-scopes");
    const userScope = requireSlugScopeId("user");
    const [users, units] = await Promise.all([
      this.repository.listUsers(ids),
      this.repository.listUserSlugs({ ids, userScope }),
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

  /** Idempotently record that `blockerId` blocks `blockedId`. 幂等地记录 `blockerId` 拉黑 `blockedId`。 */
  async add(blockerId: string, blockedId: string): Promise<void> {
    await this.repository.add(blockerId, blockedId);
  }

  /** Remove the block from `blockerId` to `blockedId` (no-op if absent). 移除 `blockerId` 到 `blockedId` 的拉黑（不存在时为无操作）。 */
  async remove(blockerId: string, blockedId: string): Promise<void> {
    await this.repository.remove(blockerId, blockedId);
  }

  /** unitIds the blocker has blocked — used to hide content in feeds. 拉黑者已拉黑的 unitId — 用于在信息流中隐藏内容。 */
  async blockedUserIds(blockerId: string): Promise<string[]> {
    return this.repository.blockedUserIds(blockerId);
  }

  /** True if either user has blocked the other — used to gate DM. 任一方拉黑对方则为 true — 用于限制私信 DM。 */
  async isBlockedEitherWay(a: string, b: string): Promise<boolean> {
    return this.repository.isBlockedEitherWay(a, b);
  }

  /** Remove every block row referencing the user (either side). 移除引用该用户（任一侧）的所有拉黑记录。 */
  async removeAllForUser(userId: string): Promise<void> {
    await this.repository.removeAllForUser(userId);
  }
}

export const blockService = new BlockService();
