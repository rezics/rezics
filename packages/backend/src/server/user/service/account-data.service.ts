import type { UserDataExport } from "@rezics/contract";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { blockService } from "../../block/block.service";
import {
  Post,
  Shelf,
  ShelfItem,
  Subscription,
  Unit,
  UnitTranslation,
  User,
  UserBlock,
  UserContentRatingPreference,
  UserNotificationPreference,
  UserPreference,
  UserPreferredLanguage,
  UserPrivacyPreference,
  UserRealmTagDisplayPreference,
  UserSubscriptionListPreference,
  UserTagApplication,
} from "../../db/schema";
import { requireSlugScopeId } from "../../infra/slug-scopes";
import { subscriptionService } from "../../subscription/subscription.service";
import { getSettings } from "./settings.service";

type ExportUserRow = {
  unitId: string;
  name: string | null;
  email: string | null;
  summary: string | null;
  avatar: string | null;
  joinDate: Date | null;
};

type ExportPostRow = {
  unitId: string;
  kind: string | null;
  title: string | null;
  createdAt: Date;
};

type ExportShelfRow = {
  unitId: string;
  title: string | null;
  updatedAt: Date;
};

type ExportUserShelfItemRow = {
  unitId: string;
  searchText: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type ExportUserTagApplicationRow = {
  unitId: string;
  tagUnitId: string;
  position: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type ExportFollowRow = {
  subscribedUnitId: string;
  channels: string[] | null;
  createdAt: Date;
};

type ExportBlockRow = {
  blockedId: string;
  createdAt: Date;
};

export interface AccountDataRepository {
  getHandle(userId: string): Promise<string | null>;
  getExportUser(userId: string): Promise<ExportUserRow>;
  getExportSettings(userId: string): Promise<unknown>;
  listExportPosts(userId: string): Promise<ExportPostRow[]>;
  listExportShelves(userId: string): Promise<ExportShelfRow[]>;
  listUserShelfItems(userId: string): Promise<ExportUserShelfItemRow[]>;
  listUserTagApplications(
    userId: string,
  ): Promise<ExportUserTagApplicationRow[]>;
  listFollows(userId: string): Promise<ExportFollowRow[]>;
  listFollowers(userId: string): Promise<Array<{ subscriberUnitId: string }>>;
  listBlocks(userId: string): Promise<ExportBlockRow[]>;
  scrubDeletedAccount(userId: string, deletedAt: Date): Promise<void>;
}

async function getServerDb() {
  const { db } = await import("../../db/client");
  return db;
}

async function loadFirstTitles(
  unitIds: readonly string[],
): Promise<Map<string, string | null>> {
  if (unitIds.length === 0) return new Map();
  const db = await getServerDb();
  const rows = await db
    .select({ unitId: UnitTranslation.unitId, title: UnitTranslation.title })
    .from(UnitTranslation)
    .where(inArray(UnitTranslation.unitId, [...unitIds]))
    .orderBy(asc(UnitTranslation.unitId), asc(UnitTranslation.language));
  const titles = new Map<string, string | null>();
  for (const row of rows) {
    if (!titles.has(row.unitId)) {
      titles.set(row.unitId, row.title);
    }
  }
  return titles;
}

function createDrizzleAccountDataRepository(): AccountDataRepository {
  return {
    async getHandle(userId) {
      const db = await getServerDb();
      const [unit] = await db
        .select({ slug: Unit.slug })
        .from(Unit)
        .where(
          and(
            eq(Unit.id, userId),
            eq(Unit.slugScope, requireSlugScopeId("user")),
            eq(Unit.type, "USER"),
          ),
        )
        .limit(1);
      return unit?.slug ?? null;
    },

    async getExportUser(userId) {
      const db = await getServerDb();
      const [user] = await db
        .select({
          unitId: User.unitId,
          name: User.name,
          email: User.email,
          summary: User.summary,
          avatar: User.avatar,
          joinDate: User.joinDate,
        })
        .from(User)
        .where(eq(User.unitId, userId))
        .limit(1);
      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }
      return user;
    },

    async getExportSettings(userId) {
      return getSettings(userId);
    },

    async listExportPosts(userId) {
      const db = await getServerDb();
      const rows = await db
        .select({
          unitId: Post.unitId,
          kind: Post.kind,
          createdAt: Post.createdAt,
        })
        .from(Post)
        .where(eq(Post.authorUserId, userId))
        .orderBy(desc(Post.createdAt));
      const titles = await loadFirstTitles(rows.map((row) => row.unitId));
      return rows.map((row) => ({
        ...row,
        title: titles.get(row.unitId) ?? null,
      }));
    },

    async listExportShelves(userId) {
      const db = await getServerDb();
      const rows = await db
        .select({
          unitId: Shelf.unitId,
          updatedAt: Shelf.updatedAt,
        })
        .from(Shelf)
        .innerJoin(Unit, eq(Unit.id, Shelf.unitId))
        .where(eq(Unit.userId, userId))
        .orderBy(desc(Shelf.updatedAt));
      const titles = await loadFirstTitles(rows.map((row) => row.unitId));
      return rows.map((row) => ({
        ...row,
        title: titles.get(row.unitId) ?? null,
      }));
    },

    async listUserShelfItems(userId) {
      const db = await getServerDb();
      const rows = await db
        .select({
          unitId: ShelfItem.itemId,
          searchText: ShelfItem.searchText,
          createdAt: ShelfItem.createdAt,
          updatedAt: ShelfItem.updatedAt,
        })
        .from(ShelfItem)
        .innerJoin(Shelf, eq(Shelf.unitId, ShelfItem.shelfId))
        .innerJoin(Unit, eq(Unit.id, Shelf.unitId))
        .where(and(eq(Unit.userId, userId), eq(ShelfItem.itemType, "unit")))
        .orderBy(desc(ShelfItem.updatedAt), asc(ShelfItem.itemId));

      const byUnitId = new Map<string, ExportUserShelfItemRow>();
      for (const row of rows) {
        if (!byUnitId.has(row.unitId)) {
          byUnitId.set(row.unitId, row);
        }
      }
      return [...byUnitId.values()];
    },

    async listUserTagApplications(userId) {
      const db = await getServerDb();
      return db
        .select({
          unitId: UserTagApplication.unitId,
          tagUnitId: UserTagApplication.tagUnitId,
          position: UserTagApplication.position,
          createdAt: UserTagApplication.createdAt,
          updatedAt: UserTagApplication.updatedAt,
        })
        .from(UserTagApplication)
        .where(eq(UserTagApplication.userId, userId))
        .orderBy(
          asc(UserTagApplication.unitId),
          asc(UserTagApplication.position),
          asc(UserTagApplication.tagUnitId),
        );
    },

    async listFollows(userId) {
      const db = await getServerDb();
      return db
        .select({
          subscribedUnitId: Subscription.subscribedUnitId,
          channels: Subscription.channels,
          createdAt: Subscription.createdAt,
        })
        .from(Subscription)
        .where(eq(Subscription.subscriberUnitId, userId));
    },

    async listFollowers(userId) {
      const db = await getServerDb();
      return db
        .select({ subscriberUnitId: Subscription.subscriberUnitId })
        .from(Subscription)
        .where(eq(Subscription.subscribedUnitId, userId));
    },

    async listBlocks(userId) {
      const db = await getServerDb();
      return db
        .select({
          blockedId: UserBlock.blockedId,
          createdAt: UserBlock.createdAt,
        })
        .from(UserBlock)
        .where(eq(UserBlock.blockerId, userId));
    },

    async scrubDeletedAccount(userId, deletedAt) {
      const db = await getServerDb();
      await db.transaction(async (tx) => {
        await tx
          .update(User)
          .set({
            email: null,
            name: null,
            avatar: null,
            summary: null,
            description: null,
            authUserId: null,
            followersCount: 0,
            followingsCount: 0,
            extra: { deletedAt: deletedAt.toISOString() },
            updatedAt: deletedAt,
          })
          .where(eq(User.unitId, userId));
        await tx
          .delete(UserPreference)
          .where(eq(UserPreference.userId, userId));
        await tx
          .delete(UserPreferredLanguage)
          .where(eq(UserPreferredLanguage.userId, userId));
        await tx
          .delete(UserContentRatingPreference)
          .where(eq(UserContentRatingPreference.userId, userId));
        await tx
          .delete(UserSubscriptionListPreference)
          .where(eq(UserSubscriptionListPreference.userId, userId));
        await tx
          .delete(UserNotificationPreference)
          .where(eq(UserNotificationPreference.userId, userId));
        await tx
          .delete(UserPrivacyPreference)
          .where(eq(UserPrivacyPreference.userId, userId));
        await tx
          .delete(UserRealmTagDisplayPreference)
          .where(eq(UserRealmTagDisplayPreference.userId, userId));
        await tx
          .update(Unit)
          .set({
            status: "DELETED",
            visibility: "PRIVATE",
            updatedAt: deletedAt,
          })
          .where(eq(Unit.id, userId));
        const shelfRows = await tx
          .select({ shelfId: Shelf.unitId })
          .from(Shelf)
          .innerJoin(Unit, eq(Unit.id, Shelf.unitId))
          .where(eq(Unit.userId, userId));
        if (shelfRows.length > 0) {
          await tx
            .update(ShelfItem)
            .set({ searchText: null, updatedAt: deletedAt })
            .where(
              inArray(
                ShelfItem.shelfId,
                shelfRows.map((row) => row.shelfId),
              ),
            );
        }
        await tx
          .delete(UserTagApplication)
          .where(eq(UserTagApplication.userId, userId));
      });
    },
  };
}

const defaultRepository = createDrizzleAccountDataRepository();

/** The caller's `@`-handle (USER unit slug), or null if none is set. 调用者的 `@` 句柄（USER unit slug），若未设置则为 null。 */
async function getHandle(
  userId: string,
  repository: AccountDataRepository = defaultRepository,
): Promise<string | null> {
  return repository.getHandle(userId);
}

/**
 * Assemble the caller's personal data as a single JSON payload. Scope is
 * documented on `userDataExportSchema`: profile, settings, authored content,
 * and social graph. Returned inline — no job/file storage.
 * 将调用者的个人数据汇集为单个 JSON 负载。范围记录在 `userDataExportSchema` 上：
 * 个人资料、设置、所撰写内容以及社交关系图。内联返回 — 不经过任务/文件存储。
 */
export async function exportUserData(
  userId: string,
  repository: AccountDataRepository = defaultRepository,
): Promise<UserDataExport> {
  const [
    user,
    settings,
    handle,
    posts,
    shelves,
    userShelfItems,
    userTagApplications,
    follows,
    blocks,
  ] = await Promise.all([
    repository.getExportUser(userId),
    repository.getExportSettings(userId),
    getHandle(userId, repository),
    repository.listExportPosts(userId),
    repository.listExportShelves(userId),
    repository.listUserShelfItems(userId),
    repository.listUserTagApplications(userId),
    repository.listFollows(userId),
    repository.listBlocks(userId),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    profile: {
      unitId: user.unitId,
      handle,
      name: user.name,
      email: user.email,
      summary: user.summary,
      avatar: user.avatar,
      joinDate: user.joinDate ? user.joinDate.toISOString() : null,
    },
    settings,
    posts: posts.map((p) => ({
      unitId: p.unitId,
      kind: p.kind ?? "",
      title: p.title ?? "",
      createdAt: p.createdAt.toISOString(),
    })),
    shelves: shelves.map((s) => ({
      unitId: s.unitId,
      title: s.title ?? "",
      updatedAt: s.updatedAt.toISOString(),
    })),
    userShelfItems: userShelfItems.map((row) => ({
      unitId: row.unitId,
      searchText: row.searchText,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
    userTagApplications: userTagApplications.map((row) => ({
      unitId: row.unitId,
      tagUnitId: row.tagUnitId,
      position: row.position,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
    follows: follows.map((f) => ({
      targetUnitId: f.subscribedUnitId,
      channels: f.channels ?? [],
      createdAt: f.createdAt.toISOString(),
    })),
    blocks: blocks.map((b) => ({
      blockedId: b.blockedId,
      createdAt: b.createdAt.toISOString(),
    })),
  };
}

/** Thrown when the deletion confirmation does not match the account handle. 当删除确认与账号句柄不匹配时抛出。 */
export class DeletionNotConfirmedError extends Error {}

/**
 * Anonymize-and-retain account deletion (the documented policy):
 *
 * - Removed/scrubbed: PII on the User row (email, name, avatar, summary,
 *   description, settings), the auth link, the public profile (USER unit set
 *   to DELETED + PRIVATE), private shelf item metadata, the user's blocks, and
 *   the user's follow edges (counters adjusted on peers).
 * - Retained: authored content (posts/reviews/books/shelves) — kept and shown
 *   as authored by a deleted user — plus moderation cases, enforcement, and
 *   audit records, which are NOT touched here for safety/audit integrity.
 *
 * Requires `confirmation` to equal the account handle; otherwise throws
 * `DeletionNotConfirmedError` and makes no changes.
 *
 * 匿名化并保留式的账号删除（已记录的策略）：
 *
 * - 移除/清除：User 行上的 PII（email、name、avatar、summary、description、
 *   settings）、auth 关联、公开个人资料（USER unit 置为 DELETED + PRIVATE）、
 *   私有书架项目元数据、用户的拉黑记录，以及用户的关注边（同步调整对端计数器）。
 * - 保留：所撰写的内容（posts/reviews/books/shelves）— 保留并显示为由已删除
 *   用户撰写 — 以及审核案件、处置与审计记录，出于安全/审计完整性，这里不予改动。
 *
 * 要求 `confirmation` 等于账号句柄；否则抛出 `DeletionNotConfirmedError`
 * 且不做任何更改。
 */
export async function deleteAccount(
  userId: string,
  confirmation: string,
  repository: AccountDataRepository = defaultRepository,
): Promise<void> {
  const handle = await getHandle(userId, repository);
  const expected = handle ?? "DELETE";
  if (confirmation.trim() !== expected) {
    throw new DeletionNotConfirmedError(
      "Confirmation does not match the account handle",
    );
  }

  // Remove follow edges in both directions, keeping peer counters consistent.
  // 移除双向的关注边，并保持对端计数器一致。
  const [followings, followers] = await Promise.all([
    repository.listFollows(userId),
    repository.listFollowers(userId),
  ]);
  for (const f of followings) {
    await subscriptionService.unsubscribe(userId, f.subscribedUnitId);
  }
  for (const f of followers) {
    await subscriptionService.unsubscribe(f.subscriberUnitId, userId);
  }

  // Clear safety state that references the user on either side.
  // 清除任一侧引用该用户的安全状态。
  await blockService.removeAllForUser(userId);

  // Scrub PII and hide the public profile. Authored content (separate Unit
  // rows) and moderation/audit records are intentionally left in place.
  // 清除 PII 并隐藏公开个人资料。所撰写内容（独立的 Unit 行）以及审核/审计
  // 记录有意保留原处。
  await repository.scrubDeletedAccount(userId, new Date());
}
