import { t } from "elysia";

export const ADMIN_REPAIR_JOB_SCOPES = [
  "search",
  "queue-failed-job",
  "history-outbox-replay",
  "cdc",
  "slug",
  "attribution",
  "counters",
] as const;

export type AdminRepairJobScope = (typeof ADMIN_REPAIR_JOB_SCOPES)[number];

export const ADMIN_REPAIR_JOB_SCOPE_SET: ReadonlySet<AdminRepairJobScope> =
  new Set(ADMIN_REPAIR_JOB_SCOPES);

export const adminRepairJobScopeSchema = t.Union([
  t.Literal(ADMIN_REPAIR_JOB_SCOPES[0]),
  t.Literal(ADMIN_REPAIR_JOB_SCOPES[1]),
  t.Literal(ADMIN_REPAIR_JOB_SCOPES[2]),
  t.Literal(ADMIN_REPAIR_JOB_SCOPES[3]),
  t.Literal(ADMIN_REPAIR_JOB_SCOPES[4]),
  t.Literal(ADMIN_REPAIR_JOB_SCOPES[5]),
  t.Literal(ADMIN_REPAIR_JOB_SCOPES[6]),
]);

export const HISTORY_OUTBOX_REPAIR_STATUSES = ["pending", "failed"] as const;

export type HistoryOutboxRepairStatus =
  (typeof HISTORY_OUTBOX_REPAIR_STATUSES)[number];

export const FAILED_HISTORY_OUTBOX_REPAIR_STATUSES = [
  HISTORY_OUTBOX_REPAIR_STATUSES[1],
] as const satisfies readonly HistoryOutboxRepairStatus[];

export const HISTORY_OUTBOX_REPAIR_STATUS_SET: ReadonlySet<
  HistoryOutboxRepairStatus
> = new Set(HISTORY_OUTBOX_REPAIR_STATUSES);

export const historyOutboxRepairStatusSchema = t.Union([
  t.Literal(HISTORY_OUTBOX_REPAIR_STATUSES[0]),
  t.Literal(HISTORY_OUTBOX_REPAIR_STATUSES[1]),
]);

export const adminRepairJobStatusSchema = t.Union([
  t.Literal("pending"),
  t.Literal("running"),
  t.Literal("succeeded"),
  t.Literal("failed"),
  t.Literal("cancelled"),
]);

export type AdminRepairJobStatus =
  (typeof adminRepairJobStatusSchema)["static"];

export const adminRepairJobDryRunRequestSchema = t.Object({
  scope: adminRepairJobScopeSchema,
  targetIds: t.Optional(t.Array(t.String())),
  historyOutboxStatuses: t.Optional(t.Array(historyOutboxRepairStatusSchema)),
  unitId: t.Optional(t.String()),
  olderThanMinutes: t.Optional(t.Number({ minimum: 0 })),
  limit: t.Optional(t.Number({ minimum: 1, maximum: 500 })),
  reason: t.Optional(t.Nullable(t.String())),
});

export type AdminRepairJobDryRunRequest =
  (typeof adminRepairJobDryRunRequestSchema)["static"];

export const adminRepairJobStartRequestSchema = t.Object({
  scope: adminRepairJobScopeSchema,
  targetIds: t.Optional(t.Array(t.String())),
  dryRunId: t.Optional(t.Nullable(t.String())),
  reason: t.String({ minLength: 3 }),
});

export type AdminRepairJobStartRequest =
  (typeof adminRepairJobStartRequestSchema)["static"];

export const adminRepairJobDryRunSchema = t.Object({
  id: t.String(),
  dryRun: t.Literal(true),
  scope: adminRepairJobScopeSchema,
  affectedCount: t.Number(),
  targetIds: t.Array(t.String()),
  sampleTargets: t.Array(t.String()),
  sampleLimited: t.Boolean(),
  warnings: t.Array(t.String()),
  generatedAt: t.String(),
});

export type AdminRepairJobDryRun =
  (typeof adminRepairJobDryRunSchema)["static"];

export const adminRepairJobQueuedOperationSchema = t.Object({
  jobId: t.Optional(t.Nullable(t.String())),
  lane: t.String(),
  kind: t.String(),
  status: t.Union([
    t.Literal("created"),
    t.Literal("coalesced"),
    t.Literal("retried"),
    t.Literal("cancelled"),
  ]),
  idempotencyKey: t.Optional(t.Nullable(t.String())),
});

export type AdminRepairJobQueuedOperation =
  (typeof adminRepairJobQueuedOperationSchema)["static"];

export const adminRepairJobOperationRequestSchema = t.Object({
  lane: t.String(),
  jobId: t.String(),
  reason: t.String({ minLength: 3 }),
});

export type AdminRepairJobOperationRequest =
  (typeof adminRepairJobOperationRequestSchema)["static"];

export const adminRepairJobOperationResponseSchema = t.Object({
  operation: adminRepairJobQueuedOperationSchema,
  auditLogId: t.Optional(t.Nullable(t.String())),
  safeSummary: t.String(),
});

export type AdminRepairJobOperationResponse =
  (typeof adminRepairJobOperationResponseSchema)["static"];

export const adminRepairJobSchema = t.Object({
  id: t.String(),
  scope: adminRepairJobScopeSchema,
  status: adminRepairJobStatusSchema,
  progress: t.Object({
    completed: t.Number(),
    total: t.Number(),
  }),
  safeSummary: t.String(),
  auditLogId: t.Optional(t.Nullable(t.String())),
  dryRunId: t.Optional(t.Nullable(t.String())),
  queuedOperations: t.Optional(t.Array(adminRepairJobQueuedOperationSchema)),
  failure: t.Optional(
    t.Nullable(
      t.Object({
        safeMessage: t.String(),
      }),
    ),
  ),
  createdAt: t.String(),
  updatedAt: t.String(),
});

export type AdminRepairJob = (typeof adminRepairJobSchema)["static"];
