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
