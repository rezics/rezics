import * as v from "valibot";
import { maintenanceIdempotency } from "../idempotency";
import { JOB_LANES } from "../lanes";
import { jobTags, uniqueTags } from "../tags";
import { commandSchema } from "./common";

export const MAINTENANCE_COMMAND_KINDS = {
  replay: "maintenance.replay",
  searchDriftRepair: "maintenance.search.driftRepair",
  searchRebuildIndex: "maintenance.search.rebuildIndex",
  seriesContentIndexRepair: "maintenance.series.contentIndexRepair",
  fanoutContinuation: "maintenance.fanout.continuation",
} as const;

export type MaintenanceCommandKind =
  (typeof MAINTENANCE_COMMAND_KINDS)[keyof typeof MAINTENANCE_COMMAND_KINDS];

const ReplayPayloadSchema = v.strictObject({
  scope: v.union([v.literal("source"), v.literal("target")]),
  key: v.string(),
});

const DriftRepairPayloadSchema = v.strictObject({
  targetType: v.union([
    v.literal("content"),
    v.literal("post"),
    v.literal("comment"),
    v.literal("poll"),
    v.literal("realm"),
    v.literal("zone"),
    v.literal("entity"),
    v.literal("user"),
    v.literal("feedback"),
    v.literal("progress"),
    v.literal("shelf-item"),
    v.literal("collection"),
    v.literal("game-media-platforms"),
    v.literal("game-media-ratings"),
  ]),
  targetId: v.string(),
});

const RebuildIndexPayloadSchema = v.strictObject({
  index: v.union([
    v.literal("content"),
    v.literal("post"),
    v.literal("comment"),
    v.literal("poll"),
    v.literal("realm"),
    v.literal("zone"),
    v.literal("entity"),
    v.literal("user"),
    v.literal("feedback"),
    v.literal("progress"),
    v.literal("shelf-item"),
    v.literal("collection"),
  ]),
  cursor: v.optional(v.string()),
  limit: v.optional(v.number()),
});

const SeriesRepairPayloadSchema = v.strictObject({
  seriesUnitId: v.string(),
});

const FanoutContinuationPayloadSchema = v.strictObject({
  fanout: v.string(),
  targetId: v.string(),
  cursor: v.string(),
  limit: v.optional(v.number()),
});

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

export const MaintenanceCommandSchema = v.union([
  ReplayCommandSchema,
  SearchDriftRepairCommandSchema,
  SearchRebuildIndexCommandSchema,
  SeriesContentIndexRepairCommandSchema,
  FanoutContinuationCommandSchema,
]);

export type MaintenanceCommand = v.InferOutput<typeof MaintenanceCommandSchema>;

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

  return v.parse(MaintenanceCommandSchema, {
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
