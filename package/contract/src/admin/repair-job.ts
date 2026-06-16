import { t } from "elysia";

export const adminRepairJobScopeSchema = t.Union([
  t.Literal("search"),
  t.Literal("queue-failed-job"),
  t.Literal("history-outbox-replay"),
  t.Literal("slug"),
  t.Literal("attribution"),
  t.Literal("counters"),
]);

export type AdminRepairJobScope = (typeof adminRepairJobScopeSchema)["static"];

export const historyOutboxRepairStatusSchema = t.Union([
  t.Literal("pending"),
  t.Literal("failed"),
]);

export type HistoryOutboxRepairStatus =
  (typeof historyOutboxRepairStatusSchema)["static"];

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
