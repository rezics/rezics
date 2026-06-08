import { type TSchema, t } from "elysia";
import { readLanguageGetQueryBase } from "../list-query-base";
import { draftMetadataSchema } from "../post/draft";
import { progressLibraryRowSchema } from "../shelf/progress";

// ============================================================
// DASHBOARD SUMMARY
// ============================================================
//
// The signed-in dashboard aggregates user continuity across domains on
// the server so the client never scatters and re-aggregates domain
// requests. Each section is wrapped in a partial-success discriminator
// so the page can render the sections that loaded and show a retry
// state for the ones that failed.
//
// 登录后的仪表盘在服务端跨领域聚合用户的连续性数据，因此客户端无需分散地
// 重新聚合各领域请求。每个区块都包裹在部分成功的判别式中，使页面能够渲染
// 已加载的区块，并为加载失败的区块显示重试状态。

/**
 * Stable error codes for a failed dashboard section.
 * 加载失败的仪表盘区块的稳定错误码。
 */
export const dashboardSectionErrorSchema = t.Object({
  code: t.String(),
  retryable: t.Boolean(),
});

export type DashboardSectionError =
  (typeof dashboardSectionErrorSchema)["static"];

/**
 * Wrap a section payload in `{ ok } | { error }`. Aggregation tolerates
 * per-section failure without failing the whole response.
 * 将区块负载包裹为 `{ ok } | { error }`。聚合容忍单个区块失败而不会使整个
 * 响应失败。
 */
export const dashboardSection = <T extends TSchema>(payload: T) =>
  t.Union([
    t.Object({ ok: payload }),
    t.Object({ error: dashboardSectionErrorSchema }),
  ]);

export type DashboardSectionResult<T> =
  | { ok: T }
  | { error: DashboardSectionError };

// ------------------------------------------------------------
// continue-reading
// 续读
// ------------------------------------------------------------

/**
 * Discriminated resume route so the client navigates without re-deriving
 * the URL. `node` preserves multi-link TOC disambiguation.
 * 判别式的续读路由，使客户端无需重新推导 URL 即可导航。`node` 保留了
 * 多链接目录的消歧信息。
 */
export const resumeRouteSchema = t.Union([
  t.Object({
    kind: t.Literal("node"),
    bookId: t.String(),
    nodeId: t.String(),
  }),
  t.Object({
    kind: t.Literal("chapter"),
    bookId: t.String(),
    chapterId: t.String(),
  }),
  t.Object({
    kind: t.Literal("book"),
    bookId: t.String(),
  }),
]);

export type ResumeRoute = (typeof resumeRouteSchema)["static"];

export const continueReadingItemSchema = t.Object({
  bookUnitId: t.String(),
  bookTitle: t.String(),
  bookCoverUrl: t.Optional(t.String()),
  /**
   * Null for legacy/first-time progress without a node anchor.
   * 对于没有节点锚点的旧数据或首次进度为 null。
   */
  lastReadNodeId: t.Nullable(t.String()),
  /**
   * Server-resolved from the TOC; null when no node or node hard-deleted.
   * 从目录在服务端解析得出；当没有节点或节点被硬删除时为 null。
   */
  lastReadNodeTitle: t.Nullable(t.String()),
  /**
   * `lastReadAnchor.text` truncated to <= 200 chars, when present.
   * 存在时，将 `lastReadAnchor.text` 截断到 <= 200 个字符。
   */
  lastReadAnchorText: t.Optional(t.String()),
  chaptersCompleted: t.Integer({ minimum: 0 }),
  chaptersTotal: t.Integer({ minimum: 0 }),
  resumeRoute: resumeRouteSchema,
});

export type ContinueReadingItem = (typeof continueReadingItemSchema)["static"];

// ------------------------------------------------------------
// lightweight per-section card summaries
// 各区块的轻量卡片摘要
// ------------------------------------------------------------

export const dashboardShelfSummarySchema = t.Object({
  shelfId: t.String(),
  title: t.String(),
  itemCount: t.Integer({ minimum: 0 }),
  coverUrls: t.Array(t.String(), { maxItems: 4 }),
});

export const dashboardRealmSummarySchema = t.Object({
  realmId: t.String(),
  name: t.String(),
  slug: t.Optional(t.String()),
  avatarUrl: t.Optional(t.String()),
  unreadCount: t.Optional(t.Integer({ minimum: 0 })),
});

export const dashboardNotificationSummarySchema = t.Object({
  unreadCount: t.Integer({ minimum: 0 }),
  latestKindKeys: t.Array(t.String(), { maxItems: 5 }),
});

export const dashboardDmSummarySchema = t.Object({
  unreadCount: t.Integer({ minimum: 0 }),
  conversationCount: t.Integer({ minimum: 0 }),
});

export const dashboardActivityItemSchema = t.Object({
  kind: t.String(),
  targetUnitId: t.Optional(t.String()),
  title: t.String(),
  at: t.String(),
});

/**
 * Safety / moderation status surfaced only when relevant. `null` ok value
 * means there is nothing to show.
 * 仅在相关时才呈现的安全 / 审核状态。`null` 的 ok 值表示没有内容可显示。
 */
export const dashboardSafetySchema = t.Object({
  enforcementActive: t.Boolean(),
  accountBlocked: t.Boolean(),
  pendingReportsAgainstUser: t.Integer({ minimum: 0 }),
  notices: t.Array(t.Object({ code: t.String(), message: t.String() }), {
    maxItems: 10,
  }),
});

// ------------------------------------------------------------
// aggregate
// 聚合
// ------------------------------------------------------------

export const dashboardSummarySchema = t.Object({
  continueReading: dashboardSection(t.Array(continueReadingItemSchema)),
  libraryProgress: dashboardSection(t.Array(progressLibraryRowSchema)),
  shelves: dashboardSection(t.Array(dashboardShelfSummarySchema)),
  realms: dashboardSection(t.Array(dashboardRealmSummarySchema)),
  notifications: dashboardSection(dashboardNotificationSummarySchema),
  dms: dashboardSection(dashboardDmSummarySchema),
  drafts: dashboardSection(t.Array(draftMetadataSchema)),
  activity: dashboardSection(t.Array(dashboardActivityItemSchema)),
  safety: dashboardSection(dashboardSafetySchema),
});

export type DashboardSummary = {
  continueReading: DashboardSectionResult<ContinueReadingItem[]>;
  libraryProgress: DashboardSectionResult<
    (typeof progressLibraryRowSchema)["static"][]
  >;
  shelves: DashboardSectionResult<
    (typeof dashboardShelfSummarySchema)["static"][]
  >;
  realms: DashboardSectionResult<
    (typeof dashboardRealmSummarySchema)["static"][]
  >;
  notifications: DashboardSectionResult<
    (typeof dashboardNotificationSummarySchema)["static"]
  >;
  dms: DashboardSectionResult<(typeof dashboardDmSummarySchema)["static"]>;
  drafts: DashboardSectionResult<(typeof draftMetadataSchema)["static"][]>;
  activity: DashboardSectionResult<
    (typeof dashboardActivityItemSchema)["static"][]
  >;
  safety: DashboardSectionResult<(typeof dashboardSafetySchema)["static"]>;
};

export type DashboardShelfSummary =
  (typeof dashboardShelfSummarySchema)["static"];
export type DashboardRealmSummary =
  (typeof dashboardRealmSummarySchema)["static"];
export type DashboardNotificationSummary =
  (typeof dashboardNotificationSummarySchema)["static"];
export type DashboardDmSummary = (typeof dashboardDmSummarySchema)["static"];
export type DashboardActivityItem =
  (typeof dashboardActivityItemSchema)["static"];
export type DashboardSafety = (typeof dashboardSafetySchema)["static"];

export const dashboardSummaryQuerySchema = t.Object({
  ...readLanguageGetQueryBase.properties,
});

export type DashboardSummaryQuery =
  (typeof dashboardSummaryQuerySchema)["static"];
