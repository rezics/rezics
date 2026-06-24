import { t } from "elysia";
import { listGetQueryBase, listPostBodyBase } from "../list-query-base";
import {
  type OffsetPaginated,
  type OffsetPaginationParams,
  paginationLimitSchema,
} from "../pagination";
import {
  type ModerationTargetKind,
  moderationTargetKindSchema,
} from "../realm/governance";

export const feedbackTypeValues = [
  "REPORT",
  "BUG",
  "FEATURE",
  "OTHER",
] as const;

/** Feedback type vocabulary shared by client contracts and storage. 客户端契约与存储共享的反馈类型词汇表。 */
export const feedbackTypeSchema = t.Union([
  t.Literal("REPORT"),
  t.Literal("BUG"),
  t.Literal("FEATURE"),
  t.Literal("OTHER"),
]);

export type FeedbackType = (typeof feedbackTypeSchema)["static"];

/**
 * Feedback DTO exposed to clients
 * 暴露给客户端的反馈 DTO
 */
export type FeedbackDTO = {
  id: string;
  userId: string;
  targetKind?: ModerationTargetKind | null;
  targetId?: string | null;
  addressedUnitId?: string | null;
  url?: string | null;
  content: string;
  type: FeedbackType;
  resolved: boolean;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export const feedbackDTOSchema = t.Object({
  id: t.String(),
  userId: t.String(),
  targetKind: t.Optional(t.Nullable(moderationTargetKindSchema)),
  targetId: t.Optional(t.Nullable(t.String())),
  addressedUnitId: t.Optional(t.Nullable(t.String())),
  url: t.Optional(t.Nullable(t.String())),
  content: t.String(),
  type: feedbackTypeSchema,
  resolved: t.Boolean(),
  resolvedAt: t.Optional(t.Nullable(t.String())),
  createdAt: t.String(),
  updatedAt: t.String(),
});

/**
 * Create feedback
 * 创建反馈
 *
 * - userId is taken from JWT on server side
 * - userId 由服务端从 JWT 中获取
 */
export type CreateFeedbackInput = {
  url?: string | null;
  targetKind?: ModerationTargetKind | null;
  targetId?: string | null;
  addressedUnitId?: string | null;
  content: string;
  type?: FeedbackType;
};

export const createFeedbackSchema = t.Object({
  targetKind: t.Optional(t.Nullable(moderationTargetKindSchema)),
  targetId: t.Optional(t.Nullable(t.String())),
  addressedUnitId: t.Optional(t.Nullable(t.String())),
  url: t.Optional(t.Nullable(t.String())),
  content: t.String(),
  type: t.Optional(feedbackTypeSchema),
});

/**
 * List / filter feedbacks (admin or per-user)
 * 列出/筛选反馈（管理员或按用户）
 */
export type FeedbackListQuery = OffsetPaginationParams & {
  ids?: string;
  q?: string;
  userId?: string;
  targetKind?: ModerationTargetKind;
  targetId?: string;
  addressedUnitId?: string;
  type?: FeedbackType;
  resolved?: boolean;
  createdAtFrom?: string;
  createdAtTo?: string;
};

export const feedbackListQuerySchema = t.Object({
  ...listGetQueryBase.properties,
  offset: t.Optional(t.Number()),
  limit: paginationLimitSchema,
  q: t.Optional(t.String()),
  userId: t.Optional(t.String()),
  targetKind: t.Optional(moderationTargetKindSchema),
  targetId: t.Optional(t.String()),
  addressedUnitId: t.Optional(t.String()),
  type: t.Optional(feedbackTypeSchema),
  resolved: t.Optional(t.Boolean()),
  createdAtFrom: t.Optional(t.String()),
  createdAtTo: t.Optional(t.String()),
});

export const feedbackListBodySchema = t.Object({
  ...listPostBodyBase.properties,
  offset: t.Optional(t.Number()),
  limit: paginationLimitSchema,
  q: t.Optional(t.String()),
  userId: t.Optional(t.String()),
  targetKind: t.Optional(moderationTargetKindSchema),
  targetId: t.Optional(t.String()),
  addressedUnitId: t.Optional(t.String()),
  type: t.Optional(feedbackTypeSchema),
  resolved: t.Optional(t.Boolean()),
  createdAtFrom: t.Optional(t.String()),
  createdAtTo: t.Optional(t.String()),
});

export type FeedbackListBody = (typeof feedbackListBodySchema)["static"];

export type FeedbackListResponse = OffsetPaginated<FeedbackDTO>;

export const feedbackListResponseSchema = t.Object({
  items: t.Array(feedbackDTOSchema),
  offset: t.Number(),
  totalItems: t.Optional(t.Number()),
});
