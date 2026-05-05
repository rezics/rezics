import { t } from "elysia";

export const SYSTEM_SHELF_KIND_KEYS = [
  "favorites",
  "backlog",
  "active",
  "completed",
] as const;

export const systemShelfKindKeySchema = t.Union([
  t.Literal("favorites"),
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

export const userExtraSchema = t.Object({
  shelves: t.Optional(
    t.Intersect([
      t.Record(t.String(), t.String()),
      t.Object({
        favorites: t.Optional(t.String()),
        backlog: t.Optional(t.String()),
        active: t.Optional(t.String()),
        completed: t.Optional(t.String()),
      }),
    ]),
  ),
});

export type UserExtra = (typeof userExtraSchema)["static"];

export const unitProgressUpsertBodySchema = t.Object({
  progress: t.Optional(t.Number({ minimum: 0, maximum: 1 })),
  status: t.Optional(userUnitProgressStatusSchema),
  completedCount: t.Optional(t.Integer({ minimum: 0 })),
  lastPosition: t.Optional(t.Nullable(t.String())),
  addTimeMs: t.Optional(t.Integer({ minimum: 0 })),
  extra: t.Optional(t.Nullable(t.Record(t.String(), t.Any()))),
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
  completedCount: t.Number({ minimum: 0 }),
  totalTimeMs: t.Number({ minimum: 0 }),
  lastPosition: t.Nullable(t.String()),
  firstSeenAt: t.String(),
  lastSeenAt: t.String(),
  extra: t.Nullable(t.Record(t.String(), t.Any())),
});

export type UnitProgressRowDTO = (typeof unitProgressRowDTOSchema)["static"];

export const unitProgressListQuerySchema = t.Object({
  cursor: t.Optional(t.String()),
  limit: t.Optional(t.Integer({ minimum: 1, maximum: 100 })),
});

export type UnitProgressListQuery =
  (typeof unitProgressListQuerySchema)["static"];

export const unitProgressListResponseSchema = t.Object({
  rows: t.Array(unitProgressRowDTOSchema),
  nextCursor: t.Nullable(t.String()),
});

export type UnitProgressListResponse =
  (typeof unitProgressListResponseSchema)["static"];

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
