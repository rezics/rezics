import { t } from "elysia";

// ============================================================
// PROFILE ACTIVITY TIMELINE
// 个人主页活动时间线
// ============================================================
//
// A read-only, time-ordered projection of a user's public activity,
// aggregating their posts/reviews/remarks, given reactions, and shelf
// updates. Privacy and content-lifecycle filtering happen server-side:
// non-public / non-published / removed subjects are omitted at the source,
// never surfaced as gaps or leaked counts.
//
// 用户公开活动的只读、按时间排序的投影，聚合其 posts/reviews/remarks、
// 给出的 reactions 以及 shelf 更新。隐私与内容生命周期的过滤在服务端进行：
// 非公开 / 未发布 / 已移除的主体在源头即被剔除，
// 绝不以空缺呈现，也不泄露计数。

export const activityKindSchema = t.Union([
  t.Literal("post"),
  t.Literal("review"),
  t.Literal("remark"),
  t.Literal("reaction"),
  t.Literal("shelf"),
]);

export type ActivityKind = (typeof activityKindSchema)["static"];

export const activityItemSchema = t.Object({
  /**
   * Stable identifier: the post/shelf unitId, or the reaction id.
   * 稳定标识符：post/shelf 的 unitId，或 reaction 的 id。
   */
  id: t.String(),
  kind: activityKindSchema,
  /**
   * Best-effort display title; empty when unknown (client falls back to a kind label).
   * 尽力而为的展示标题；未知时为空（客户端回退到 kind 标签）。
   */
  title: t.String(),
  /**
   * App route to the activity's subject.
   * 指向该活动主体的应用路由。
   */
  href: t.String(),
  /**
   * ISO timestamp the activity occurred, used for ordering.
   * 活动发生的 ISO 时间戳，用于排序。
   */
  at: t.String(),
  /**
   * For `kind: "reaction"`, the reaction key (e.g. "upvote").
   * 当 `kind: "reaction"` 时，为 reaction 键（例如 "upvote"）。
   */
  reaction: t.Optional(t.String()),
});

export type ActivityItem = (typeof activityItemSchema)["static"];

export const activityListQuerySchema = t.Object({
  /**
   * Return only items strictly older than this ISO timestamp (pagination watermark).
   * 仅返回严格早于该 ISO 时间戳的条目（分页水位线）。
   */
  before: t.Optional(t.String()),
  limit: t.Optional(t.Integer({ minimum: 1, maximum: 50 })),
});

export type ActivityListQuery = (typeof activityListQuerySchema)["static"];

export const activityListResponseSchema = t.Object({
  items: t.Array(activityItemSchema),
  /**
   * Watermark cursor for the next page (pass back as `before`); null when exhausted.
   * 下一页的水位线游标（作为 `before` 回传）；耗尽时为 null。
   */
  nextCursor: t.Optional(t.Nullable(t.String())),
});

export type ActivityListResponse =
  (typeof activityListResponseSchema)["static"];
