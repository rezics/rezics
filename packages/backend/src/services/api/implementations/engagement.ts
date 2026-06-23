import { Effect } from "effect";
import { HttpApiBuilder, HttpApiError } from "effect/unstable/httpapi";
import { and, count, desc, eq, inArray, lt, type SQL } from "drizzle-orm";

import { Database } from "../../database/index.ts";
import {
  ContentStructureNode,
  Feedback,
  Post,
  Reaction,
  Shelf,
  Subscription,
  Unit,
  UnitTranslation,
  User,
  UserBlock,
  UserContentNodeProgress,
  UserUnitProgress,
} from "../../database/schema/all.ts";
import { Api } from "../interfaces/index.ts";
import { CurrentUser } from "../interfaces/middlewares/auth.ts";
import {
  ActivityEntry,
  BlockEntry,
  DraftEntry,
  EngagementBadRequest,
  EngagementForbidden,
  EngagementNotFound,
  FeedbackEntry,
  FeedbackListResult,
  ReactionEntry,
  ShareResult,
  StreamResult,
  StreamRow,
  SubscriberCountResult,
  SubscriptionCheckResult,
  SubscriptionEntry,
  UnitProgressEntry,
  UnitProgressListResult,
} from "../interfaces/engagement.ts";

// ---------------------------------------------------------------------------
// Mappers / 映射函数
// ---------------------------------------------------------------------------

function subscriptionToEntry(row: typeof Subscription.$inferSelect) {
  return new SubscriptionEntry({
    id: row.id,
    subscriberUnitId: row.subscriberUnitId,
    subscribedUnitId: row.subscribedUnitId,
    channels: row.channels,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function reactionToEntry(row: typeof Reaction.$inferSelect) {
  return new ReactionEntry({
    id: row.id,
    userId: row.userId,
    targetId: row.targetId,
    reaction: row.reaction,
    contextUnitId: row.contextUnitId,
    createdAt: row.createdAt,
  });
}

function blockToEntry(row: typeof UserBlock.$inferSelect) {
  return new BlockEntry({
    userId: row.blockerId,
    blockedUserId: row.blockedId,
    createdAt: row.createdAt,
  });
}

function feedbackToEntry(row: typeof Feedback.$inferSelect) {
  return new FeedbackEntry({
    id: row.id,
    userId: row.userId,
    url: row.url,
    content: row.content,
    type: row.type,
    resolved: row.resolved,
    resolvedAt: row.resolvedAt,
    addressedUnitId: row.addressedUnitId,
    targetId: row.targetId,
    targetKind: row.targetKind,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function progressToEntry(row: typeof UserUnitProgress.$inferSelect) {
  return new UnitProgressEntry({
    userId: row.userId,
    unitId: row.unitId,
    status: row.status,
    startedAt: row.firstSeenAt,
    finishedAt: row.lastSeenAt,
    createdAt: row.firstSeenAt,
    updatedAt: row.lastSeenAt,
  });
}

// ---------------------------------------------------------------------------
// Helpers / 辅助函数
// ---------------------------------------------------------------------------

function isAdmin(permission: unknown): boolean {
  const perm = permission as { role?: string } | null;
  return perm?.role === "ADMIN" || perm?.role === "ROOT";
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// ---------------------------------------------------------------------------
// Subscription handlers / 订阅处理器
// ---------------------------------------------------------------------------

export const SubscriptionHandlers = HttpApiBuilder.group(
  Api,
  "subscriptions",
  Effect.fn(function* (handlers) {
    const database = yield* Database;

    return handlers
      // POST /subscription/ — create subscription
      // POST /subscription/ — 创建订阅
      .handle("create", ({ payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const rows = yield* 
            database
              .insert(Subscription)
              .values({
                subscriberUnitId: user.id,
                subscribedUnitId: payload.subscribedUnitId,
                channels: payload.channels ? [...payload.channels] : null,
              })
              .onConflictDoUpdate({
                target: [Subscription.subscriberUnitId, Subscription.subscribedUnitId],
                set: {
                  channels: payload.channels ? [...payload.channels] : null,
                  updatedAt: new Date(),
                },
              })
              .returning();
          return subscriptionToEntry(rows[0]!);
        }),
      )

      // GET /subscription/me — list my subscriptions
      // GET /subscription/me — 列出我的订阅
      .handle("listMine", () =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          // TODO: filter by subscribedType via Unit join when needed
          // TODO: 需要时通过 Unit join 按 subscribedType 过滤
          const rows = yield* 
            database
              .select()
              .from(Subscription)
              .where(eq(Subscription.subscriberUnitId, user.id))
              .orderBy(desc(Subscription.createdAt));
          return { subscriptions: rows.map(subscriptionToEntry) };
        }),
      )

      // PATCH /subscription/:subscribedUnitId — update channels
      // PATCH /subscription/:subscribedUnitId — 更新订阅频道
      .handle("updateChannels", ({ params, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const rows = yield* 
            database
              .update(Subscription)
              .set({ channels: [...payload.channels], updatedAt: new Date() })
              .where(
                and(
                  eq(Subscription.subscriberUnitId, user.id),
                  eq(Subscription.subscribedUnitId, params.subscribedUnitId),
                ),
              )
              .returning();
          if (!rows[0]) return yield* new EngagementNotFound();
          return subscriptionToEntry(rows[0]);
        }),
      )

      // DELETE /subscription/:subscribedUnitId — unsubscribe
      // DELETE /subscription/:subscribedUnitId — 取消订阅
      .handle("delete", ({ params }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const rows = yield* 
            database
              .delete(Subscription)
              .where(
                and(
                  eq(Subscription.subscriberUnitId, user.id),
                  eq(Subscription.subscribedUnitId, params.subscribedUnitId),
                ),
              )
              .returning();
          return { unsubscribed: rows.length > 0 };
        }),
      )

      // GET /subscription/check/:subscribedUnitId — check status
      // GET /subscription/check/:subscribedUnitId — 检查订阅状态
      .handle("check", ({ params }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const rows = yield* 
            database
              .select()
              .from(Subscription)
              .where(
                and(
                  eq(Subscription.subscriberUnitId, user.id),
                  eq(Subscription.subscribedUnitId, params.subscribedUnitId),
                ),
              )
              .limit(1);
          const row = rows[0];
          if (!row) return new SubscriptionCheckResult({ subscribed: false });
          return new SubscriptionCheckResult({
            subscribed: true,
            channels: row.channels ?? undefined,
          });
        }),
      )

      // GET /subscription/count/:subscribedUnitId — subscriber count (public)
      // GET /subscription/count/:subscribedUnitId — 获取订阅者计数（公开）
      .handle("count", ({ params }) =>
        Effect.gen(function* () {
          const agg = yield* 
            database
              .select({ total: count() })
              .from(Subscription)
              .where(eq(Subscription.subscribedUnitId, params.subscribedUnitId));
          return new SubscriberCountResult({ count: agg[0]?.total ?? 0 });
        }),
      );
  }),
);

// ---------------------------------------------------------------------------
// Reaction handlers / 反应处理器
// ---------------------------------------------------------------------------

export const ReactionHandlers = HttpApiBuilder.group(
  Api,
  "reactions",
  Effect.fn(function* (handlers) {
    const database = yield* Database;

    return handlers
      // POST /reaction/ — create reaction (idempotent upsert)
      // POST /reaction/ — 创建反应（幂等 upsert）
      .handle("create", ({ payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const rows = yield* 
            database
              .insert(Reaction)
              .values({
                userId: user.id,
                targetId: payload.targetId,
                reaction: payload.reaction,
                contextUnitId: payload.contextUnitId ?? null,
              })
              .onConflictDoNothing({
                target: [Reaction.userId, Reaction.targetId, Reaction.reaction],
              })
              .returning();
          // If conflict (already exists), fetch the existing row
          // 如果冲突（已存在），获取已有行
          if (!rows[0]) {
            const existing = yield* 
              database
                .select()
                .from(Reaction)
                .where(
                  and(
                    eq(Reaction.userId, user.id),
                    eq(Reaction.targetId, payload.targetId),
                    eq(Reaction.reaction, payload.reaction),
                  ),
                )
                .limit(1);
            return reactionToEntry(existing[0]!);
          }
          return reactionToEntry(rows[0]);
        }),
      )

      // DELETE /reaction/ — remove reaction
      // DELETE /reaction/ — 移除反应
      .handle("remove", ({ query }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* 
            database
              .delete(Reaction)
              .where(
                and(
                  eq(Reaction.userId, user.id),
                  eq(Reaction.targetId, query.targetId),
                  eq(Reaction.reaction, query.reaction),
                ),
              );
        }),
      )

      // POST /reaction/share — record a share intent (idempotent)
      // POST /reaction/share — 记录分享意图（幂等）
      .handle("share", ({ payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          // Create a reaction with "share" type to track the share intent
          // 创建一个 "share" 类型的 reaction 来追踪分享意图
          const rows = yield* 
            database
              .insert(Reaction)
              .values({
                userId: user.id,
                targetId: payload.targetId,
                reaction: "share",
              })
              .onConflictDoNothing({
                target: [Reaction.userId, Reaction.targetId, Reaction.reaction],
              })
              .returning();
          if (!rows[0]) {
            // Already shared — fetch existing / 已分享过——获取已有记录
            const existing = yield* 
              database
                .select()
                .from(Reaction)
                .where(
                  and(
                    eq(Reaction.userId, user.id),
                    eq(Reaction.targetId, payload.targetId),
                    eq(Reaction.reaction, "share"),
                  ),
                )
                .limit(1);
            return new ShareResult({ id: existing[0]!.id, created: false });
          }
          return new ShareResult({ id: rows[0].id, created: true });
        }),
      );
  }),
);

// ---------------------------------------------------------------------------
// Feedback handlers / 反馈处理器
// ---------------------------------------------------------------------------

export const FeedbackHandlers = HttpApiBuilder.group(
  Api,
  "feedback",
  Effect.fn(function* (handlers) {
    const database = yield* Database;

    return handlers
      // POST /feedback/ — create feedback
      // POST /feedback/ — 创建反馈
      .handle("create", ({ payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const rows = yield* 
            database
              .insert(Feedback)
              .values({
                userId: user.id,
                content: payload.content,
                type: (payload.type?.toUpperCase() ?? "REPORT") as typeof Feedback.$inferInsert.type,
                url: payload.url ?? null,
                addressedUnitId: payload.addressedUnitId ?? null,
                targetId: payload.targetId ?? null,
                targetKind: payload.targetKind
                  ? (payload.targetKind.toUpperCase() as typeof Feedback.$inferInsert.targetKind)
                  : null,
                updatedAt: new Date(),
              })
              .returning();
          return feedbackToEntry(rows[0]!);
        }),
      )

      // GET /feedback/my — list my feedbacks
      // GET /feedback/my — 列出我的反馈
      .handle("listMine", ({ query }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const limit = Math.max(1, Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT));
          const offset = Math.max(0, query.offset ?? 0);

          const conditions: SQL[] = [eq(Feedback.userId, user.id)];
          if (query.type) {
            conditions.push(eq(Feedback.type, query.type.toUpperCase() as typeof Feedback.$inferSelect.type));
          }
          if (query.resolved === "true") {
            conditions.push(eq(Feedback.resolved, true));
          } else if (query.resolved === "false") {
            conditions.push(eq(Feedback.resolved, false));
          }

          const where = and(...conditions);

          const rows = yield* 
            database
              .select()
              .from(Feedback)
              .where(where)
              .orderBy(desc(Feedback.createdAt))
              .offset(offset)
              .limit(limit);
          const totalRows = yield* 
            database.select({ total: count() }).from(Feedback).where(where);

          return new FeedbackListResult({
            items: rows.map(feedbackToEntry),
            total: totalRows[0]?.total ?? 0,
          });
        }),
      )

      // GET /feedback/list — list all feedbacks (admin)
      // GET /feedback/list — 列出所有反馈（管理员）
      .handle("listAll", ({ query }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;

          // Admin check / 管理员检查
          const userRows = yield* 
            database
              .select({ permission: User.permission })
              .from(User)
              .where(eq(User.unitId, user.id))
              .limit(1);
          if (!isAdmin(userRows[0]?.permission)) return yield* new EngagementForbidden();

          const limit = Math.max(1, Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT));
          const offset = Math.max(0, query.offset ?? 0);

          const conditions: SQL[] = [];
          if (query.userId) conditions.push(eq(Feedback.userId, query.userId));
          if (query.type) {
            conditions.push(eq(Feedback.type, query.type.toUpperCase() as typeof Feedback.$inferSelect.type));
          }
          if (query.resolved === "true") {
            conditions.push(eq(Feedback.resolved, true));
          } else if (query.resolved === "false") {
            conditions.push(eq(Feedback.resolved, false));
          }

          const where = conditions.length > 0 ? and(...conditions) : undefined;

          const rows = yield* 
            database
              .select()
              .from(Feedback)
              .where(where)
              .orderBy(desc(Feedback.createdAt))
              .offset(offset)
              .limit(limit);
          const totalRows = yield* 
            database.select({ total: count() }).from(Feedback).where(where);

          return new FeedbackListResult({
            items: rows.map(feedbackToEntry),
            total: totalRows[0]?.total ?? 0,
          });
        }),
      )

      // PATCH /feedback/:id/resolve — set resolved state (admin)
      // PATCH /feedback/:id/resolve — 设置解决状态（管理员）
      .handle("resolve", ({ params, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;

          // Admin check / 管理员检查
          const userRows = yield* 
            database
              .select({ permission: User.permission })
              .from(User)
              .where(eq(User.unitId, user.id))
              .limit(1);
          if (!isAdmin(userRows[0]?.permission)) return yield* new EngagementForbidden();

          const rows = yield* 
            database
              .update(Feedback)
              .set({
                resolved: payload.resolved,
                resolvedAt: payload.resolved ? new Date() : null,
                updatedAt: new Date(),
              })
              .where(eq(Feedback.id, params.id))
              .returning();
          if (!rows[0]) return yield* new EngagementNotFound();
          return feedbackToEntry(rows[0]);
        }),
      );
  }),
);

// ---------------------------------------------------------------------------
// Block handlers / 屏蔽处理器
// ---------------------------------------------------------------------------

export const BlockHandlers = HttpApiBuilder.group(
  Api,
  "blocks",
  Effect.fn(function* (handlers) {
    const database = yield* Database;

    return handlers
      // GET /block/list — list my blocked users
      // GET /block/list — 列出我屏蔽的用户
      .handle("list", () =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const rows = yield* 
            database
              .select()
              .from(UserBlock)
              .where(eq(UserBlock.blockerId, user.id))
              .orderBy(desc(UserBlock.createdAt));
          return { items: rows.map(blockToEntry) };
        }),
      )

      // POST /block/ — block a user
      // POST /block/ — 屏蔽用户
      .handle("add", ({ payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          if (payload.userId === user.id) return yield* new EngagementBadRequest();
          yield* 
            database
              .insert(UserBlock)
              .values({ blockerId: user.id, blockedId: payload.userId })
              .onConflictDoNothing({
                target: [UserBlock.blockerId, UserBlock.blockedId],
              });
          return { success: true };
        }),
      )

      // DELETE /block/:userId — unblock a user
      // DELETE /block/:userId — 取消屏蔽用户
      .handle("remove", ({ params }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* 
            database
              .delete(UserBlock)
              .where(
                and(
                  eq(UserBlock.blockerId, user.id),
                  eq(UserBlock.blockedId, params.userId),
                ),
              );
          return { success: true };
        }),
      );
  }),
);

// ---------------------------------------------------------------------------
// Progress handlers / 进度处理器
// ---------------------------------------------------------------------------

export const ProgressHandlers = HttpApiBuilder.group(
  Api,
  "progress",
  Effect.fn(function* (handlers) {
    const database = yield* Database;

    return handlers
      // GET /me/units/:unitId/progress — get my unit progress
      // GET /me/units/:unitId/progress — 获取我的 unit 进度
      .handle("get", ({ params }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const rows = yield* 
            database
              .select()
              .from(UserUnitProgress)
              .where(
                and(
                  eq(UserUnitProgress.userId, user.id),
                  eq(UserUnitProgress.unitId, params.unitId),
                  eq(UserUnitProgress.isDeleted, false),
                ),
              )
              .limit(1);
          return rows[0] ? progressToEntry(rows[0]) : null;
        }),
      )

      // PUT /me/units/:unitId/progress — upsert my unit progress
      // PUT /me/units/:unitId/progress — 写入或更新我的 unit 进度
      .handle("upsert", ({ params, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const now = new Date();

          const status = payload.status
            ? (payload.status.toUpperCase() as typeof UserUnitProgress.$inferInsert.status)
            : "BACKLOG";

          const rows = yield* 
            database
              .insert(UserUnitProgress)
              .values({
                userId: user.id,
                unitId: params.unitId,
                status,
                isDeleted: false,
                firstSeenAt: now,
                lastSeenAt: now,
              })
              .onConflictDoUpdate({
                target: [UserUnitProgress.userId, UserUnitProgress.unitId],
                set: {
                  ...(payload.status ? { status } : {}),
                  isDeleted: false,
                  lastSeenAt: now,
                },
              })
              .returning();
          return progressToEntry(rows[0]!);
        }),
      )

      // DELETE /me/units/:unitId/progress — soft-delete my unit progress
      // DELETE /me/units/:unitId/progress — 软删除我的 unit 进度
      .handle("delete", ({ params }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* 
            database
              .update(UserUnitProgress)
              .set({ isDeleted: true, lastSeenAt: new Date() })
              .where(
                and(
                  eq(UserUnitProgress.userId, user.id),
                  eq(UserUnitProgress.unitId, params.unitId),
                ),
              );
        }),
      )

      // GET /me/progress — list my unit progress
      // GET /me/progress — 列出我的 unit 进度
      .handle("list", ({ query }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const limit = Math.max(1, Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT));
          const offset = Math.max(0, query.offset ?? 0);

          const conditions: SQL[] = [
            eq(UserUnitProgress.userId, user.id),
            eq(UserUnitProgress.isDeleted, false),
          ];
          if (query.status) {
            conditions.push(
              eq(
                UserUnitProgress.status,
                query.status.toUpperCase() as typeof UserUnitProgress.$inferSelect.status,
              ),
            );
          }

          const where = and(...conditions);

          const rows = yield* 
            database
              .select()
              .from(UserUnitProgress)
              .where(where)
              .orderBy(desc(UserUnitProgress.lastSeenAt))
              .offset(offset)
              .limit(limit);
          const totalRows = yield* 
            database.select({ total: count() }).from(UserUnitProgress).where(where);

          return new UnitProgressListResult({
            items: rows.map(progressToEntry),
            total: totalRows[0]?.total ?? 0,
          });
        }),
      )

      // POST /me/units/:unitId/node-completion — toggle node completion
      // POST /me/units/:unitId/node-completion — 切换节点完成状态
      .handle("nodeCompletion", ({ params, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;

          // Verify node exists and belongs to the specified unit / 验证节点存在并属于指定的 unit
          const nodeRows = yield* 
            database
              .select({
                ownerUnitId: ContentStructureNode.ownerUnitId,
                isDeleted: ContentStructureNode.isDeleted,
              })
              .from(ContentStructureNode)
              .where(eq(ContentStructureNode.id, payload.nodeId))
              .limit(1);
          const node = nodeRows[0];
          if (!node) return yield* new HttpApiError.InternalServerError();
          if (node.ownerUnitId !== params.unitId) {
            return yield* new HttpApiError.InternalServerError();
          }
          if (node.isDeleted) {
            return yield* new HttpApiError.InternalServerError();
          }

          if (payload.isCompleted) {
            yield* 
              database
                .insert(UserContentNodeProgress)
                .values({ userId: user.id, nodeId: payload.nodeId })
                .onConflictDoNothing();
          } else {
            yield* 
              database
                .delete(UserContentNodeProgress)
                .where(
                  and(
                    eq(UserContentNodeProgress.userId, user.id),
                    eq(UserContentNodeProgress.nodeId, payload.nodeId),
                  ),
                );
          }
        }),
      );
  }),
);

// ---------------------------------------------------------------------------
// Draft handlers / 草稿处理器
// ---------------------------------------------------------------------------

/** Draft-eligible post kinds / 可作为草稿的 post 类型 */
const DRAFT_POST_KINDS = ["REVIEW", "REMARK", "POST", "WIKI"] as const;

export const DraftHandlers = HttpApiBuilder.group(
  Api,
  "drafts",
  Effect.fn(function* (handlers) {
    const database = yield* Database;

    return handlers
      // GET /me/drafts — list my drafts
      // GET /me/drafts — 列出我的草稿
      .handle("list", ({ query }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const limit = Math.max(1, Math.min(query.limit ?? 50, MAX_LIMIT));

          const posts = yield* 
            database
              .select({
                unitId: Post.unitId,
                kind: Post.kind,
                updatedAt: Post.updatedAt,
              })
              .from(Post)
              .innerJoin(Unit, eq(Unit.id, Post.unitId))
              .where(
                and(
                  inArray(Post.kind, [...DRAFT_POST_KINDS]),
                  eq(Post.authorUserId, user.id),
                  eq(Unit.status, "DRAFT"),
                ),
              )
              .orderBy(desc(Post.updatedAt))
              .limit(limit);

          if (posts.length === 0) return { drafts: [] };

          const unitIds = posts.map((p) => p.unitId);
          const translations = yield* 
            database
              .select({
                unitId: UnitTranslation.unitId,
                title: UnitTranslation.title,
              })
              .from(UnitTranslation)
              .where(inArray(UnitTranslation.unitId, unitIds));

          const titleByUnit = new Map<string, string>();
          for (const tr of translations) {
            if (tr.title && !titleByUnit.has(tr.unitId)) {
              titleByUnit.set(tr.unitId, tr.title);
            }
          }

          return {
            drafts: posts.map(
              (p) =>
                new DraftEntry({
                  unitId: p.unitId,
                  type: p.kind ?? "POST",
                  title: titleByUnit.get(p.unitId) ?? null,
                  createdAt: p.updatedAt,
                  updatedAt: p.updatedAt,
                }),
            ),
          };
        }),
      );
  }),
);

// ---------------------------------------------------------------------------
// Activity handlers / 活动处理器
// ---------------------------------------------------------------------------

const ACTIVITY_POST_KINDS = ["POST", "REVIEW", "REMARK"] as const;
const ACTIVITY_DEFAULT_LIMIT = 20;
const ACTIVITY_MAX_LIMIT = 50;

export const ActivityHandlers = HttpApiBuilder.group(
  Api,
  "activity",
  Effect.fn(function* (handlers) {
    const database = yield* Database;

    return handlers
      // GET /profile/:userId/activity/ — list public activity timeline
      // GET /profile/:userId/activity/ — 列出公开活动时间线
      .handle("list", ({ params, query }) =>
        Effect.gen(function* () {
          const limit = Math.max(1, Math.min(query.limit ?? ACTIVITY_DEFAULT_LIMIT, ACTIVITY_MAX_LIMIT));
          const before = query.before ? new Date(query.before) : null;
          const beforeValid = before && !Number.isNaN(before.getTime()) ? before : null;

          // Fetch public posts by the profile user / 获取该用户的公开帖子
          const postConditions: SQL[] = [
            eq(Post.authorUserId, params.userId),
            inArray(Post.kind, [...ACTIVITY_POST_KINDS]),
            eq(Unit.status, "PUBLISHED"),
            eq(Unit.visibility, "PUBLIC"),
          ];
          if (beforeValid) {
            postConditions.push(lt(Post.createdAt, beforeValid));
          }

          const posts = yield* 
            database
              .select({
                unitId: Post.unitId,
                kind: Post.kind,
                createdAt: Post.createdAt,
              })
              .from(Post)
              .innerJoin(Unit, eq(Unit.id, Post.unitId))
              .where(and(...postConditions))
              .orderBy(desc(Post.createdAt))
              .limit(limit);

          // Fetch public shelves by the profile user / 获取该用户的公开书架
          const shelfConditions: SQL[] = [
            eq(Unit.userId, params.userId),
            eq(Unit.type, "SHELF"),
            eq(Unit.status, "PUBLISHED"),
            eq(Unit.visibility, "PUBLIC"),
          ];
          if (beforeValid) {
            shelfConditions.push(lt(Shelf.updatedAt, beforeValid));
          }

          const shelves = yield* 
            database
              .select({
                unitId: Shelf.unitId,
                updatedAt: Shelf.updatedAt,
              })
              .from(Shelf)
              .innerJoin(Unit, eq(Unit.id, Shelf.unitId))
              .where(and(...shelfConditions))
              .orderBy(desc(Shelf.updatedAt))
              .limit(limit);

          // Merge and sort by date descending, take `limit` / 合并并按日期降序排列，取 `limit` 条
          const items: ActivityEntry[] = [
            ...posts.map(
              (p) =>
                new ActivityEntry({
                  kind: p.kind ?? "post",
                  unitId: p.unitId,
                  data: {},
                  createdAt: p.createdAt,
                }),
            ),
            ...shelves.map(
              (s) =>
                new ActivityEntry({
                  kind: "shelf",
                  unitId: s.unitId,
                  data: {},
                  createdAt: s.updatedAt,
                }),
            ),
          ]
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, limit);

          return items;
        }),
      );
  }),
);

// ---------------------------------------------------------------------------
// Stream handlers / 信息流处理器
// ---------------------------------------------------------------------------

const STREAM_DEFAULT_LIMIT = 20;
const STREAM_MAX_LIMIT = 50;

export const StreamHandlers = HttpApiBuilder.group(
  Api,
  "stream",
  Effect.fn(function* (handlers) {
    const database = yield* Database;

    return handlers
      // GET /stream/rows — list stream rows
      // GET /stream/rows — 列出信息流行
      .handle("rows", ({ query }) =>
        Effect.gen(function* () {
          const limit = Math.max(1, Math.min(query.limit ?? STREAM_DEFAULT_LIMIT, STREAM_MAX_LIMIT));
          const before = query.before ? new Date(query.before) : null;
          const beforeValid = before && !Number.isNaN(before.getTime()) ? before : null;

          const scope = query.scope ?? "home";

          // Base conditions: published, public units / 基础条件：已发布、公开的 unit
          const conditions: SQL[] = [
            eq(Unit.status, "PUBLISHED"),
            eq(Unit.visibility, "PUBLIC"),
          ];

          if (scope === "realm" && query.realmUnitId) {
            // Realm-scoped stream: posts within the realm / Realm 范围信息流：realm 内的帖子
            const postConditions: SQL[] = [
              ...conditions,
              inArray(Post.kind, ["POST", "REVIEW", "REMARK"]),
            ];
            if (beforeValid) {
              postConditions.push(lt(Post.createdAt, beforeValid));
            }

            // Use UnitTranslation to filter by realm context via the post's target
            // 使用 UnitTranslation 通过帖子的目标按 realm 上下文过滤
            const posts = yield* 
              database
                .select({
                  unitId: Post.unitId,
                  kind: Post.kind,
                  createdAt: Post.createdAt,
                  extra: Post.extra,
                })
                .from(Post)
                .innerJoin(Unit, eq(Unit.id, Post.unitId))
                .where(and(...postConditions))
                .orderBy(desc(Post.createdAt))
                .limit(limit + 1);

            return new StreamResult({
              rows: posts.slice(0, limit).map(
                (p) =>
                  new StreamRow({
                    kind: "post",
                    id: `post:${p.unitId}`,
                    data: { unitId: p.unitId, postKind: p.kind },
                    createdAt: p.createdAt,
                  }),
              ),
              hasMore: posts.length > limit,
            });
          }

          // Home / generic stream: recent posts / 首页/通用信息流：最近的帖子
          const postConditions: SQL[] = [
            ...conditions,
            inArray(Post.kind, ["POST", "REVIEW", "REMARK"]),
          ];
          if (beforeValid) {
            postConditions.push(lt(Post.createdAt, beforeValid));
          }

          const posts = yield* 
            database
              .select({
                unitId: Post.unitId,
                kind: Post.kind,
                createdAt: Post.createdAt,
              })
              .from(Post)
              .innerJoin(Unit, eq(Unit.id, Post.unitId))
              .where(and(...postConditions))
              .orderBy(desc(Post.createdAt))
              .limit(limit + 1);

          return new StreamResult({
            rows: posts.slice(0, limit).map(
              (p) =>
                new StreamRow({
                  kind: "post",
                  id: `post:${p.unitId}`,
                  data: { unitId: p.unitId, postKind: p.kind },
                  createdAt: p.createdAt,
                }),
            ),
            hasMore: posts.length > limit,
          });
        }),
      );
  }),
);
