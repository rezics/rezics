import { t } from "elysia";
import { readLanguageGetQueryBase } from "../list-query-base";
import { catalogEntryKindSchema, unitTypeSchema } from "../unit/unit";

export const SYSTEM_SHELF_KIND_KEYS = [
  "favorites",
  "saved",
  "backlog",
  "active",
  "completed",
] as const;

export const systemShelfKindKeySchema = t.Union([
  t.Literal("favorites"),
  t.Literal("saved"),
  t.Literal("backlog"),
  t.Literal("active"),
  t.Literal("completed"),
]);

export type SystemShelfKindKey = (typeof systemShelfKindKeySchema)["static"];

export const userUnitProgressStatusValues = [
  "BACKLOG",
  "ACTIVE",
  "PAUSED",
  "COMPLETED",
  "DROPPED",
] as const;

export const userUnitProgressStatusSchema = t.Union([
  t.Literal("BACKLOG"),
  t.Literal("ACTIVE"),
  t.Literal("PAUSED"),
  t.Literal("COMPLETED"),
  t.Literal("DROPPED"),
]);

export type UserUnitProgressStatus =
  (typeof userUnitProgressStatusSchema)["static"];

export const lastReadAnchorSchema = t.Object(
  {
    text: t.String({ minLength: 1, maxLength: 200 }),
  },
  { additionalProperties: false },
);

export type LastReadAnchor = (typeof lastReadAnchorSchema)["static"];

export const nodeCompletionToggleBodySchema = t.Object({
  nodeId: t.String(),
  isCompleted: t.Boolean(),
});

export type NodeCompletionToggleBody =
  (typeof nodeCompletionToggleBodySchema)["static"];

export const progressExtraSchema = t.Object(
  {
    paused: t.Optional(
      t.Object(
        { reasonPostUnitIds: t.Array(t.String()) },
        { additionalProperties: false },
      ),
    ),
    dropped: t.Optional(
      t.Object(
        { reasonPostUnitIds: t.Array(t.String()) },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
);

export type ProgressExtra = (typeof progressExtraSchema)["static"];

export const PROGRESS_EXTRA_KNOWN_KEYS = ["paused", "dropped"] as const;

export const unitProgressUpsertBodySchema = t.Object({
  progress: t.Optional(t.Number({ minimum: 0, maximum: 1 })),
  status: t.Optional(userUnitProgressStatusSchema),
  completedCount: t.Optional(t.Integer({ minimum: 0 })),
  lastReadNodeId: t.Optional(t.Nullable(t.String())),
  lastReadAnchor: t.Optional(t.Nullable(lastReadAnchorSchema)),
  addTimeMs: t.Optional(t.Integer({ minimum: 0 })),
  extra: t.Optional(t.Nullable(progressExtraSchema)),
});

export type UnitProgressUpsertBody =
  (typeof unitProgressUpsertBodySchema)["static"];

export const unitProgressParamsSchema = t.Object({
  unitId: t.String(),
});

export type UnitProgressParams = (typeof unitProgressParamsSchema)["static"];

export const unitProgressRowDTOSchema = t.Object({
  userId: t.String(),
  unitId: t.String(),
  progress: t.Number({ minimum: 0, maximum: 1 }),
  status: userUnitProgressStatusSchema,
  isDeleted: t.Boolean(),
  completedCount: t.Number({ minimum: 0 }),
  totalTimeMs: t.Number({ minimum: 0 }),
  lastReadNodeId: t.Nullable(t.String()),
  lastReadAnchor: t.Nullable(lastReadAnchorSchema),
  firstSeenAt: t.String(),
  lastSeenAt: t.String(),
  extra: t.Nullable(progressExtraSchema),
});

export type UnitProgressRowDTO = (typeof unitProgressRowDTOSchema)["static"];

export const unitProgressListQuerySchema = t.Object({
  cursor: t.Optional(t.String()),
  limit: t.Optional(t.Integer({ minimum: 1, maximum: 100 })),
  ...readLanguageGetQueryBase.properties,
});

export type UnitProgressListQuery =
  (typeof unitProgressListQuerySchema)["static"];

export const unitProgressListResponseSchema = t.Object({
  rows: t.Array(unitProgressRowDTOSchema),
  nextCursor: t.Nullable(t.String()),
});

export type UnitProgressListResponse =
  (typeof unitProgressListResponseSchema)["static"];

/**
 * Discriminated resume route so progress surfaces can navigate without
 * re-deriving the URL. `node` preserves multi-link TOC disambiguation.
 * 判别式的续读路由，使进度界面无需重新推导 URL 即可导航。`node` 保留
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

export const continueReadingListQuerySchema = t.Object({
  limit: t.Optional(t.Integer({ minimum: 1, maximum: 50 })),
  ...readLanguageGetQueryBase.properties,
});

export type ContinueReadingListQuery =
  (typeof continueReadingListQuerySchema)["static"];

export const continueReadingListResponseSchema = t.Object({
  items: t.Array(continueReadingItemSchema),
});

export type ContinueReadingListResponse =
  (typeof continueReadingListResponseSchema)["static"];

export const progressLibraryShelfLinkSchema = t.Object({
  shelfId: t.String(),
  title: t.String(),
});

export type ProgressLibraryShelfLink =
  (typeof progressLibraryShelfLinkSchema)["static"];

export const progressLibraryUnitSummarySchema = t.Object({
  unitId: t.String(),
  title: t.String(),
  coverUrl: t.Optional(t.String()),
  unitType: unitTypeSchema,
  catalogEntryKind: t.Nullable(catalogEntryKindSchema),
  targetUnitId: t.Nullable(t.String()),
});

export type ProgressLibraryUnitSummary =
  (typeof progressLibraryUnitSummarySchema)["static"];

export const progressLibraryRowSchema = t.Object({
  progress: unitProgressRowDTOSchema,
  progressUnit: progressLibraryUnitSummarySchema,
  mainUnitContext: t.Nullable(progressLibraryUnitSummarySchema),
  resumeRoute: t.Optional(
    t.Union([
      t.Object({
        kind: t.Literal("node"),
        bookId: t.String(),
        nodeId: t.String(),
      }),
      t.Object({
        kind: t.Literal("book"),
        bookId: t.String(),
      }),
    ]),
  ),
  shelves: t.Array(progressLibraryShelfLinkSchema),
});

export type ProgressLibraryRow = (typeof progressLibraryRowSchema)["static"];

export const progressLibraryListResponseSchema = t.Object({
  rows: t.Array(progressLibraryRowSchema),
  nextCursor: t.Nullable(t.String()),
});

export type ProgressLibraryListResponse =
  (typeof progressLibraryListResponseSchema)["static"];

export const unitProgressStatusCountsSchema = t.Object({
  BACKLOG: t.Number({ minimum: 0 }),
  ACTIVE: t.Number({ minimum: 0 }),
  PAUSED: t.Number({ minimum: 0 }),
  COMPLETED: t.Number({ minimum: 0 }),
  DROPPED: t.Number({ minimum: 0 }),
});

export type UnitProgressStatusCounts =
  (typeof unitProgressStatusCountsSchema)["static"];

export const unitProgressStatsResponseSchema = t.Object({
  viewerCount: t.Number({ minimum: 0 }),
  statusCounts: unitProgressStatusCountsSchema,
  bucketCounts: t.Array(t.Number({ minimum: 0 }), {
    minItems: 10,
    maxItems: 10,
  }),
});

export type UnitProgressStatsResponse =
  (typeof unitProgressStatsResponseSchema)["static"];
