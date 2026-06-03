import { t } from "elysia";
import {
  type ModerationTargetKind,
  moderationTargetKindSchema,
} from "../realm/governance";
import { listGetQueryBase, listPostBodyBase } from "../list-query-base";
import {
  type OffsetPaginated,
  type OffsetPaginationParams,
  paginationLimitSchema,
} from "../pagination";

/**
 * Feedback type enum (mirrors Prisma FeedbackType)
 */
export const feedbackTypeSchema = t.Union([
  t.Literal("REPORT"),
  t.Literal("BUG"),
  t.Literal("FEATURE"),
  t.Literal("OTHER"),
]);

export type FeedbackType = (typeof feedbackTypeSchema)["static"];

/**
 * Feedback DTO exposed to clients
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
 *
 * - userId is taken from JWT on server side
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
