import { t } from "elysia";

// ============================================================
// DRAFT METADATA (cross-type unified listing)
// 草稿元数据（跨类型统一列表）。
// ============================================================
//
// Each content type (review, post, remark, wiki, shelf description)
// already persists its own draft. `DraftMetadata` is the unified,
// read-only projection the dashboard and the `u/me/drafts` page consume
// to list and recover drafts across all types without duplicating each
// type's storage model.
// 每种内容类型（review、post、remark、wiki、shelf description）都已各自持久化
// 其草稿。`DraftMetadata` 是仪表盘和 `u/me/drafts` 页面所消费的统一只读投影，
// 用于跨所有类型列出并恢复草稿，而无需重复每种类型的存储模型。

export const draftKindSchema = t.Union([
  t.Literal("review"),
  t.Literal("post"),
  t.Literal("remark"),
  t.Literal("wiki"),
  t.Literal("shelf-description"),
]);

export type DraftKind = (typeof draftKindSchema)["static"];

export const draftMetadataSchema = t.Object({
  /** Stable per-type draft identifier (used for recover/discard). 每种类型稳定的草稿标识符（用于恢复/丢弃）。 */
  id: t.String(),
  kind: draftKindSchema,
  /** Display title; falls back to a type-appropriate placeholder. 显示标题；回退到与类型匹配的占位符。 */
  title: t.String(),
  /** Short plain-text excerpt of the draft body, <= 200 chars. 草稿正文的纯文本短摘要，<= 200 字符。 */
  excerpt: t.Optional(t.String()),
  /** ISO timestamp of the last edit, used for ordering. 最后一次编辑的 ISO 时间戳，用于排序。 */
  updatedAt: t.String(),
  /**
   * The Unit the draft targets, when the draft is attached to existing
   * content (e.g. a review of a book, a remark on a chapter).
   * 当草稿附着于已有内容时，草稿所针对的 Unit（例如对某本书的 review、
   * 对某一章的 remark）。
   */
  targetUnitId: t.Optional(t.Nullable(t.String())),
  /** Resume route the client navigates to in order to continue editing. 客户端跳转以继续编辑的恢复路由。 */
  resumeRoute: t.String(),
});

export type DraftMetadata = (typeof draftMetadataSchema)["static"];

export const draftListResponseSchema = t.Object({
  drafts: t.Array(draftMetadataSchema),
});

export type DraftListResponse = (typeof draftListResponseSchema)["static"];

export const draftListQuerySchema = t.Object({
  kind: t.Optional(draftKindSchema),
  limit: t.Optional(t.Integer({ minimum: 1, maximum: 100 })),
});

export type DraftListQuery = (typeof draftListQuerySchema)["static"];
