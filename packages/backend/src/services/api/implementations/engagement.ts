import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { and, count, desc, eq } from "drizzle-orm";

import { Database } from "../../database/index.ts";
import {
  Reaction,
  Subscription,
  UserBlock,
} from "../../database/schema/all.ts";
import { Api } from "../interfaces/index.ts";
import { CurrentUser } from "../interfaces/middlewares/auth.ts";
import {
  BlockEntry,
  EngagementBadRequest,
  EngagementNotFound,
  ReactionEntry,
  SubscriberCountResult,
  SubscriptionCheckResult,
  SubscriptionEntry,
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

// ---------------------------------------------------------------------------
// Subscription handlers / 订阅处理器
// ---------------------------------------------------------------------------

export const SubscriptionHandlers = HttpApiBuilder.group(
  Api,
  "subscriptions",
  Effect.fn(function* (handlers) {
    const db = yield* Database;

    return handlers
      // POST /subscription/ — create subscription
      // POST /subscription/ — 创建订阅
      .handle("create", ({ payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const rows = yield* Effect.orDie(
            db
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
              .returning(),
          );
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
          const rows = yield* Effect.orDie(
            db
              .select()
              .from(Subscription)
              .where(eq(Subscription.subscriberUnitId, user.id))
              .orderBy(desc(Subscription.createdAt)),
          );
          return { subscriptions: rows.map(subscriptionToEntry) };
        }),
      )

      // PATCH /subscription/:subscribedUnitId — update channels
      // PATCH /subscription/:subscribedUnitId — 更新订阅频道
      .handle("updateChannels", ({ params, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const rows = yield* Effect.orDie(
            db
              .update(Subscription)
              .set({ channels: [...payload.channels], updatedAt: new Date() })
              .where(
                and(
                  eq(Subscription.subscriberUnitId, user.id),
                  eq(Subscription.subscribedUnitId, params.subscribedUnitId),
                ),
              )
              .returning(),
          );
          if (!rows[0]) return yield* new EngagementNotFound();
          return subscriptionToEntry(rows[0]);
        }),
      )

      // DELETE /subscription/:subscribedUnitId — unsubscribe
      // DELETE /subscription/:subscribedUnitId — 取消订阅
      .handle("delete", ({ params }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const rows = yield* Effect.orDie(
            db
              .delete(Subscription)
              .where(
                and(
                  eq(Subscription.subscriberUnitId, user.id),
                  eq(Subscription.subscribedUnitId, params.subscribedUnitId),
                ),
              )
              .returning(),
          );
          return { unsubscribed: rows.length > 0 };
        }),
      )

      // GET /subscription/check/:subscribedUnitId — check status
      // GET /subscription/check/:subscribedUnitId — 检查订阅状态
      .handle("check", ({ params }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const rows = yield* Effect.orDie(
            db
              .select()
              .from(Subscription)
              .where(
                and(
                  eq(Subscription.subscriberUnitId, user.id),
                  eq(Subscription.subscribedUnitId, params.subscribedUnitId),
                ),
              )
              .limit(1),
          );
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
          const agg = yield* Effect.orDie(
            db
              .select({ total: count() })
              .from(Subscription)
              .where(eq(Subscription.subscribedUnitId, params.subscribedUnitId)),
          );
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
    const db = yield* Database;

    return handlers
      // POST /reaction/ — create reaction (idempotent upsert)
      // POST /reaction/ — 创建反应（幂等 upsert）
      .handle("create", ({ payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const rows = yield* Effect.orDie(
            db
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
              .returning(),
          );
          // If conflict (already exists), fetch the existing row
          // 如果冲突（已存在），获取已有行
          if (!rows[0]) {
            const existing = yield* Effect.orDie(
              db
                .select()
                .from(Reaction)
                .where(
                  and(
                    eq(Reaction.userId, user.id),
                    eq(Reaction.targetId, payload.targetId),
                    eq(Reaction.reaction, payload.reaction),
                  ),
                )
                .limit(1),
            );
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
          yield* Effect.orDie(
            db
              .delete(Reaction)
              .where(
                and(
                  eq(Reaction.userId, user.id),
                  eq(Reaction.targetId, query.targetId),
                  eq(Reaction.reaction, query.reaction),
                ),
              ),
          );
        }),
      )

      // POST /reaction/share — stub
      // POST /reaction/share — 桩
      .handle("share", () => Effect.die("TODO: not implemented"));
  }),
);

// ---------------------------------------------------------------------------
// Feedback handlers / 反馈处理器 — stubs
// ---------------------------------------------------------------------------

export const FeedbackHandlers = HttpApiBuilder.group(
  Api,
  "feedback",
  Effect.fn(function* (handlers) {
    return handlers
      .handle("create", () => Effect.die("TODO: not implemented"))
      .handle("listMine", () => Effect.die("TODO: not implemented"))
      .handle("listAll", () => Effect.die("TODO: not implemented"))
      .handle("resolve", () => Effect.die("TODO: not implemented"));
  }),
);

// ---------------------------------------------------------------------------
// Block handlers / 屏蔽处理器
// ---------------------------------------------------------------------------

export const BlockHandlers = HttpApiBuilder.group(
  Api,
  "blocks",
  Effect.fn(function* (handlers) {
    const db = yield* Database;

    return handlers
      // GET /block/list — list my blocked users
      // GET /block/list — 列出我屏蔽的用户
      .handle("list", () =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const rows = yield* Effect.orDie(
            db
              .select()
              .from(UserBlock)
              .where(eq(UserBlock.blockerId, user.id))
              .orderBy(desc(UserBlock.createdAt)),
          );
          return { items: rows.map(blockToEntry) };
        }),
      )

      // POST /block/ — block a user
      // POST /block/ — 屏蔽用户
      .handle("add", ({ payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          if (payload.userId === user.id) return yield* new EngagementBadRequest();
          yield* Effect.orDie(
            db
              .insert(UserBlock)
              .values({ blockerId: user.id, blockedId: payload.userId })
              .onConflictDoNothing({
                target: [UserBlock.blockerId, UserBlock.blockedId],
              }),
          );
          return { success: true };
        }),
      )

      // DELETE /block/:userId — unblock a user
      // DELETE /block/:userId — 取消屏蔽用户
      .handle("remove", ({ params }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* Effect.orDie(
            db
              .delete(UserBlock)
              .where(
                and(
                  eq(UserBlock.blockerId, user.id),
                  eq(UserBlock.blockedId, params.userId),
                ),
              ),
          );
          return { success: true };
        }),
      );
  }),
);

// ---------------------------------------------------------------------------
// Progress handlers / 进度处理器 — stubs
// ---------------------------------------------------------------------------

export const ProgressHandlers = HttpApiBuilder.group(
  Api,
  "progress",
  Effect.fn(function* (handlers) {
    return handlers
      .handle("get", () => Effect.die("TODO: not implemented"))
      .handle("upsert", () => Effect.die("TODO: not implemented"))
      .handle("delete", () => Effect.die("TODO: not implemented"))
      .handle("list", () => Effect.die("TODO: not implemented"))
      .handle("nodeCompletion", () => Effect.die("TODO: not implemented"));
  }),
);

// ---------------------------------------------------------------------------
// Draft handlers / 草稿处理器 — stub
// ---------------------------------------------------------------------------

export const DraftHandlers = HttpApiBuilder.group(
  Api,
  "drafts",
  Effect.fn(function* (handlers) {
    return handlers.handle("list", () => Effect.die("TODO: not implemented"));
  }),
);

// ---------------------------------------------------------------------------
// Activity handlers / 活动处理器 — stub
// ---------------------------------------------------------------------------

export const ActivityHandlers = HttpApiBuilder.group(
  Api,
  "activity",
  Effect.fn(function* (handlers) {
    return handlers.handle("list", () => Effect.die("TODO: not implemented"));
  }),
);

// ---------------------------------------------------------------------------
// Stream handlers / 信息流处理器 — stub
// ---------------------------------------------------------------------------

export const StreamHandlers = HttpApiBuilder.group(
  Api,
  "stream",
  Effect.fn(function* (handlers) {
    return handlers.handle("rows", () => Effect.die("TODO: not implemented"));
  }),
);
