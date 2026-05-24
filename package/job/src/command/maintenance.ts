import * as v from "valibot";
import { maintenanceIdempotency } from "../idempotency";
import { JOB_LANES } from "../lanes";
import { jobTags, uniqueTags } from "../tags";
import { commandSchema } from "./common";

export const MAINTENANCE_COMMAND_KINDS = {
  replay: "maintenance.replay",
  searchDriftRepair: "maintenance.search.driftRepair",
  searchRebuildIndex: "maintenance.search.rebuildIndex",
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
    v.literal("realm"),
    v.literal("entity"),
    v.literal("user"),
    v.literal("feedback"),
    v.literal("progress"),
  ]),
  targetId: v.string(),
});

const RebuildIndexPayloadSchema = v.strictObject({
  index: v.union([
    v.literal("content"),
    v.literal("post"),
    v.literal("realm"),
    v.literal("entity"),
    v.literal("user"),
    v.literal("feedback"),
    v.literal("progress"),
  ]),
  cursor: v.optional(v.string()),
  limit: v.optional(v.number()),
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
export const FanoutContinuationCommandSchema = commandSchema(
  MAINTENANCE_COMMAND_KINDS.fanoutContinuation,
  JOB_LANES.maintenance,
  FanoutContinuationPayloadSchema,
);

export const MaintenanceCommandSchema = v.union([
  ReplayCommandSchema,
  SearchDriftRepairCommandSchema,
  SearchRebuildIndexCommandSchema,
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
