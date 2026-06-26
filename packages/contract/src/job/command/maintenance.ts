import { t, type Static } from "elysia";
import { maintenanceIdempotency } from "../idempotency";
import { JOB_LANES } from "../lanes";
import { jobTags, uniqueTags } from "../tags";
import { commandSchema, parseSchema } from "./common";

export const MAINTENANCE_COMMAND_KINDS = {
  replay: "maintenance.replay",
  searchDriftRepair: "maintenance.search.driftRepair",
  searchRebuildIndex: "maintenance.search.rebuildIndex",
  seriesContentIndexRepair: "maintenance.series.contentIndexRepair",
  fanoutContinuation: "maintenance.fanout.continuation",
} as const;

export type MaintenanceCommandKind =
  (typeof MAINTENANCE_COMMAND_KINDS)[keyof typeof MAINTENANCE_COMMAND_KINDS];

const ReplayPayloadSchema = t.Object(
  {
    scope: t.Union([t.Literal("source"), t.Literal("target")]),
    key: t.String(),
  },
  { additionalProperties: false },
);

const DriftRepairPayloadSchema = t.Object(
  {
    targetType: t.Union([
      t.Literal("content"),
      t.Literal("post"),
      t.Literal("comment"),
      t.Literal("poll"),
      t.Literal("realm"),
      t.Literal("zone"),
      t.Literal("tag"),
      t.Literal("label"),
      t.Literal("entity"),
      t.Literal("user"),
      t.Literal("feedback"),
      t.Literal("progress"),
      t.Literal("shelf-item"),
      t.Literal("collection"),
      t.Literal("game-media-platforms"),
      t.Literal("game-media-ratings"),
    ]),
    targetId: t.String(),
  },
  { additionalProperties: false },
);

const RebuildIndexPayloadSchema = t.Object(
  {
    index: t.Union([
      t.Literal("content"),
      t.Literal("post"),
      t.Literal("comment"),
      t.Literal("poll"),
      t.Literal("realm"),
      t.Literal("zone"),
      t.Literal("tag"),
      t.Literal("label"),
      t.Literal("entity"),
      t.Literal("user"),
      t.Literal("feedback"),
      t.Literal("progress"),
      t.Literal("shelf-item"),
      t.Literal("collection"),
    ]),
    cursor: t.Optional(t.String()),
    limit: t.Optional(t.Number()),
  },
  { additionalProperties: false },
);

const SeriesRepairPayloadSchema = t.Object(
  { seriesUnitId: t.String() },
  { additionalProperties: false },
);

const FanoutContinuationPayloadSchema = t.Object(
  {
    fanout: t.String(),
    targetId: t.String(),
    cursor: t.String(),
    limit: t.Optional(t.Number()),
  },
  { additionalProperties: false },
);

export const ReplayCommandSchema = commandSchema(
  MAINTENANCE_COMMAND_KINDS.replay,
  JOB_LANES.maintenance,
  ReplayPayloadSchema,
);
export const SearchDriftRepairCommandSchema = commandSchema(
  MAINTENANCE_COMMAND_KINDS.searchDriftRepair,
  JOB_LANES.maintenance,
  DriftRepairPayloadSchema,
);
export const SearchRebuildIndexCommandSchema = commandSchema(
  MAINTENANCE_COMMAND_KINDS.searchRebuildIndex,
  JOB_LANES.maintenance,
  RebuildIndexPayloadSchema,
);
export const SeriesContentIndexRepairCommandSchema = commandSchema(
  MAINTENANCE_COMMAND_KINDS.seriesContentIndexRepair,
  JOB_LANES.maintenance,
  SeriesRepairPayloadSchema,
);
export const FanoutContinuationCommandSchema = commandSchema(
  MAINTENANCE_COMMAND_KINDS.fanoutContinuation,
  JOB_LANES.maintenance,
  FanoutContinuationPayloadSchema,
);

export const MaintenanceCommandSchema = t.Union([
  ReplayCommandSchema,
  SearchDriftRepairCommandSchema,
  SearchRebuildIndexCommandSchema,
  SeriesContentIndexRepairCommandSchema,
  FanoutContinuationCommandSchema,
]);

export type MaintenanceCommand = Static<typeof MaintenanceCommandSchema>;

export function createMaintenanceCommand(
  kind: MaintenanceCommandKind,
  payload: MaintenanceCommand["payload"],
  source: MaintenanceCommand["source"] = { type: "maintenance" },
): MaintenanceCommand {
  const idempotencyKey =
    kind === MAINTENANCE_COMMAND_KINDS.searchDriftRepair &&
    "targetType" in payload
      ? maintenanceIdempotency.driftRepair(payload.targetType, payload.targetId)
      : kind === MAINTENANCE_COMMAND_KINDS.searchRebuildIndex &&
          "index" in payload
        ? maintenanceIdempotency.rebuildIndex(payload.index, payload.cursor)
        : kind === MAINTENANCE_COMMAND_KINDS.seriesContentIndexRepair &&
            "seriesUnitId" in payload
          ? maintenanceIdempotency.seriesRepair(
              "contentIndex",
              payload.seriesUnitId,
            )
          : kind === MAINTENANCE_COMMAND_KINDS.fanoutContinuation &&
              "fanout" in payload
            ? maintenanceIdempotency.fanoutContinuation(
                payload.fanout,
                payload.targetId,
                payload.cursor,
              )
            : "scope" in payload
              ? maintenanceIdempotency.replay(payload.scope, payload.key)
              : `${kind}:unknown`;

  return parseSchema(MaintenanceCommandSchema, {
    kind,
    lane: JOB_LANES.maintenance,
    payload,
    idempotencyKey,
    source,
    tags: uniqueTags([
      jobTags.domain("maintenance"),
      jobTags.maintenance(kind),
      jobTags.source(source.type),
    ]),
  });
}
