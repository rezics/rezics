import { t } from "elysia";
import { listGetQueryBase } from "./list-query-base";
import {
  paginationLimitSchema,
  type OffsetPaginated,
  type OffsetPaginationParams,
} from "./pagination";

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
  unitId?: string | null;
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
  unitId: t.Optional(t.Nullable(t.String())),
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
  unitId?: string | null;
  content: string;
  type?: FeedbackType;
};

export const createFeedbackSchema = t.Object({
  unitId: t.Optional(t.Nullable(t.String())),
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
  unitId?: string;
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
  unitId: t.Optional(t.String()),
  type: t.Optional(feedbackTypeSchema),
  resolved: t.Optional(t.Boolean()),
  createdAtFrom: t.Optional(t.String()),
  createdAtTo: t.Optional(t.String()),
});

export type FeedbackListResponse = OffsetPaginated<FeedbackDTO>;

export const feedbackListResponseSchema = t.Object({
  items: t.Array(feedbackDTOSchema),
  offset: t.Number(),
  totalItems: t.Optional(t.Number()),
});
