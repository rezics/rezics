import type {
  AdminRepairJob,
  AdminRepairJobDryRun,
  AdminRepairJobDryRunRequest,
  AdminRepairJobOperationRequest,
  AdminRepairJobOperationResponse,
  AdminRepairJobQueuedOperation,
  AdminRepairJobStartRequest,
  HistoryOutboxRepairStatus,
} from "@rezics/contract";
import {
  createHistoryOutboxIngestBatchCommand,
  createHistoryOutboxIngestCommand,
  createMaintenanceCommand,
  type EnqueueResult,
  MAINTENANCE_COMMAND_KINDS,
} from "@rezics/job";
import { and, asc, eq, inArray, lte } from "drizzle-orm";
import { db, HistoryOutbox, type ServerDb } from "@/db";
import { getSystemStatusSummary } from "@/diagnostic";
import { env } from "@/env";
import { governanceAuditService } from "@/governance/audit.service";
import { type JobProducer, serverJobProducer } from "@/job/job-boundary";

type RepairJobProducer = Pick<JobProducer, "enqueue">;

type AdminRepairJobServiceOptions = {
  jobProducer: RepairJobProducer;
  database: ServerDb;
  fetchImpl: typeof fetch;
  jobRunnerBaseUrl?: string;
  internalSecret?: string;
  auditService: Pick<typeof governanceAuditService, "appendPrivilegedMutation">;
};

type HistoryOutboxReplayTargetInput = Pick<
  AdminRepairJobDryRunRequest,
  | "historyOutboxStatuses"
  | "limit"
  | "olderThanMinutes"
  | "targetIds"
  | "unitId"
>;

const SEARCH_INDEX_REBUILD_TARGETS = {
  content: "content",
  feedbacks: "feedback",
  users: "user",
  posts: "post",
  comments: "comment",
  polls: "poll",
  realms: "realm",
  zones: "zone",
  entities: "entity",
  user_unit_progress: "progress",
  shelf_items: "shelf-item",
} as const;

type SearchIndexUid = keyof typeof SEARCH_INDEX_REBUILD_TARGETS;

function nowIso() {
  return new Date().toISOString();
}

function buildId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function filterTargets(targets: string[], requested?: string[]) {
  if (!requested?.length) return targets;
  const allowed = new Set(requested);
  return targets.filter((target) => allowed.has(target));
}

function boundedTargetLimit(limit?: number) {
  if (!limit || !Number.isFinite(limit)) return 50;
  return Math.min(Math.max(Math.floor(limit), 1), 500);
}

function safeFailureMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "Repair job could not be queued. No data was mutated.";
}

function operationFromEnqueue(
  result: EnqueueResult,
): AdminRepairJobQueuedOperation {
  return {
    jobId: result.jobId ?? null,
    lane: result.lane,
    kind: result.kind,
    status: result.status,
    idempotencyKey: result.idempotencyKey,
  };
}

function parseSearchIndexTarget(target: string) {
  return SEARCH_INDEX_REBUILD_TARGETS[target as SearchIndexUid];
}

function parseFailedJobTarget(target: string) {
  const separator = target.indexOf(":");
  if (separator <= 0 || separator === target.length - 1) return null;
  return {
    lane: baseFailedJobLane(target.slice(0, separator)),
    id: target.slice(separator + 1),
  };
}

async function findHistoryOutboxReplayTargets(
  database: ServerDb,
  input: HistoryOutboxReplayTargetInput,
) {
  const statuses: HistoryOutboxRepairStatus[] = input.historyOutboxStatuses
    ?.length
    ? [...new Set(input.historyOutboxStatuses)]
    : ["pending", "failed"];
  const olderThan = input.olderThanMinutes
    ? new Date(Date.now() - input.olderThanMinutes * 60 * 1000)
    : null;
  const rows = await database
    .select({
      id: HistoryOutbox.id,
    })
    .from(HistoryOutbox)
    .where(
      and(
        inArray(HistoryOutbox.status, statuses),
        input.targetIds?.length
          ? inArray(HistoryOutbox.id, input.targetIds)
          : undefined,
        input.unitId ? eq(HistoryOutbox.unitId, input.unitId) : undefined,
        olderThan ? lte(HistoryOutbox.createdAt, olderThan) : undefined,
      ),
    )
    .orderBy(asc(HistoryOutbox.createdAt), asc(HistoryOutbox.id))
    .limit(boundedTargetLimit(input.limit));

  return rows.map((row) => row.id);
}

function jobRunnerUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/+$/, "")}${path}`;
}

function baseFailedJobLane(lane: string) {
  return lane.endsWith(".dead") ? lane.slice(0, -".dead".length) : lane;
}

function cdcIssueTarget(sourceId: string, code: string) {
  return `${sourceId}:${code}`;
}

function isHistoryOutboxReplayTarget(target: string) {
  return target === "history:outbox-replay";
}

function cdcRepairCommandForTarget(target: string) {
  const [sourceId] = target.split(":");
  if (sourceId === "source" || sourceId === "reaction") {
    return `task service -- cdc repair --source=${sourceId}`;
  }
  return "task service -- cdc repair";
}

async function retryFailedJob(
  options: AdminRepairJobServiceOptions,
  target: string,
): Promise<AdminRepairJobQueuedOperation> {
  const parsed = parseFailedJobTarget(target);
  if (!parsed) {
    throw new Error(
      "Failed job repair targets must use lane:id format from the dry-run result.",
    );
  }
  if (!options.jobRunnerBaseUrl || !options.internalSecret) {
    throw new Error("Job runner admin endpoints are not configured.");
  }

  const response = await options.fetchImpl(
    jobRunnerUrl(
      options.jobRunnerBaseUrl,
      `/admin/jobs/failed/${encodeURIComponent(parsed.lane)}/${encodeURIComponent(parsed.id)}/retry`,
    ),
    {
      method: "POST",
      headers: { "x-internal-secret": options.internalSecret },
    },
  );
  if (!response.ok) {
    throw new Error(`Failed job retry returned HTTP ${response.status}.`);
  }

  return {
    jobId: parsed.id,
    lane: parsed.lane,
    kind: "job-runner.failed.retry",
    status: "retried",
    idempotencyKey: null,
  };
}

async function discardFailedJob(
  options: AdminRepairJobServiceOptions,
  input: AdminRepairJobOperationRequest,
): Promise<AdminRepairJobQueuedOperation> {
  if (!options.jobRunnerBaseUrl || !options.internalSecret) {
    throw new Error("Job runner admin endpoints are not configured.");
  }

  const response = await options.fetchImpl(
    jobRunnerUrl(
      options.jobRunnerBaseUrl,
      `/admin/jobs/failed/${encodeURIComponent(baseFailedJobLane(input.lane))}/${encodeURIComponent(input.jobId)}/discard`,
    ),
    {
      method: "POST",
      headers: { "x-internal-secret": options.internalSecret },
    },
  );
  if (!response.ok) {
    throw new Error(`Failed job cancel returned HTTP ${response.status}.`);
  }

  return {
    jobId: input.jobId,
    lane: baseFailedJobLane(input.lane),
    kind: "job-runner.failed.cancel",
    status: "cancelled",
    idempotencyKey: null,
  };
}

async function appendRepairAudit(
  options: AdminRepairJobServiceOptions,
  input: {
    actorUserId?: string;
    action: string;
    targetId: string;
    reason: string;
    correlationId: string;
    metadata?: Record<string, unknown>;
  },
) {
  if (!input.actorUserId) return null;
  return options.auditService.appendPrivilegedMutation({
    actorUserId: input.actorUserId,
    action: input.action,
    targetKind: "admin-repair-job",
    targetId: input.targetId,
    reason: input.reason,
    correlationId: input.correlationId,
    metadata: input.metadata,
  });
}

function createAdminRepairJobService(options: AdminRepairJobServiceOptions) {
  return {
    async dryRun(
      input: AdminRepairJobDryRunRequest & { actorUserId?: string },
    ): Promise<AdminRepairJobDryRun> {
      const system = await getSystemStatusSummary();
      const warnings: string[] = [];
      let targets: string[] = [];

      if (input.scope === "search") {
        targets = system.meili.indexes
          .filter(
            (index) =>
              index.expected.supportsFullSync !== false &&
              (index.settingsDrift?.hasDrift || !index.exists),
          )
          .map((index) => index.uid);
      } else if (input.scope === "queue-failed-job") {
        targets = system.queue.failedJobs
          .map((job) => (job.id && job.lane ? `${job.lane}:${job.id}` : null))
          .filter((target): target is string => Boolean(target));
      } else if (input.scope === "history-outbox-replay") {
        targets = await findHistoryOutboxReplayTargets(options.database, input);
      } else if (input.scope === "cdc") {
        targets = system.cdc.detectedIssues.map((issue) =>
          cdcIssueTarget(issue.sourceId, issue.code),
        );
        if (
          system.historyOutbox?.pendingWithoutIngestJob ||
          (system.historyOutbox?.failed ?? 0) > 0 ||
          (system.historyOutbox?.retryReady ?? 0) > 0
        ) {
          targets.push("history:outbox-replay");
        }
        warnings.push(
          ...system.cdc.detectedIssues.map((issue) =>
            [
              `${issue.sourceId}:${issue.code} - ${issue.message}`,
              issue.remediation ? `Remediation: ${issue.remediation}` : null,
            ]
              .filter(Boolean)
              .join(" "),
          ),
        );
        if (targets.some((target) => !isHistoryOutboxReplayTarget(target))) {
          warnings.push(
            "CDC publication and replication slot repairs are infrastructure operations. Run task service -- cdc repair from the repo root after stopping duplicate Sequin consumers.",
          );
        }
      } else {
        warnings.push(
          `${input.scope} dry-run contract is available; detector implementation is pending.`,
        );
      }

      const uniqueTargets = [
        ...new Set(filterTargets(targets, input.targetIds)),
      ];
      const sampleTargets = uniqueTargets.slice(0, 20);
      const correlationId = crypto.randomUUID();
      const audit = await appendRepairAudit(options, {
        actorUserId: input.actorUserId,
        action: "repair.dry-run",
        targetId: input.scope,
        reason: input.reason ?? "Admin repair dry-run",
        correlationId,
        metadata: {
          scope: input.scope,
          targetCount: uniqueTargets.length,
          sampleTargets,
          filters: {
            historyOutboxStatuses: input.historyOutboxStatuses ?? null,
            unitId: input.unitId ?? null,
            olderThanMinutes: input.olderThanMinutes ?? null,
            limit: input.limit ?? null,
          },
        },
      });

      return {
        id: audit?.id ?? buildId("dryrun"),
        dryRun: true,
        scope: input.scope,
        affectedCount: uniqueTargets.length,
        targetIds: uniqueTargets,
        sampleTargets,
        sampleLimited: uniqueTargets.length > sampleTargets.length,
        warnings,
        generatedAt: nowIso(),
      };
    },

    async start(
      input: AdminRepairJobStartRequest & { actorUserId?: string },
    ): Promise<AdminRepairJob> {
      const now = nowIso();
      const targetIds = input.targetIds?.filter(Boolean) ?? [];
      const queuedOperations: AdminRepairJobQueuedOperation[] = [];
      const correlationId = crypto.randomUUID();
      const startAudit = await appendRepairAudit(options, {
        actorUserId: input.actorUserId,
        action: "repair.start",
        targetId: input.scope,
        reason: input.reason,
        correlationId,
        metadata: {
          scope: input.scope,
          dryRunId: input.dryRunId ?? null,
          targetCount: targetIds.length,
        },
      });

      try {
        if (input.scope === "search") {
          for (const target of targetIds) {
            const index = parseSearchIndexTarget(target);
            if (!index) {
              throw new Error(
                `Search repair target ${target} is not supported.`,
              );
            }
            const command = createMaintenanceCommand(
              MAINTENANCE_COMMAND_KINDS.searchRebuildIndex,
              { index },
              { type: "server", service: "admin-repair-job" },
            );
            queuedOperations.push(
              operationFromEnqueue(await options.jobProducer.enqueue(command)),
            );
          }
        } else if (input.scope === "queue-failed-job") {
          for (const target of targetIds) {
            const operation = await retryFailedJob(options, target);
            queuedOperations.push(operation);
            await appendRepairAudit(options, {
              actorUserId: input.actorUserId,
              action: "repair.retry",
              targetId: operation.jobId ?? target,
              reason: input.reason,
              correlationId,
              metadata: {
                scope: input.scope,
                lane: operation.lane,
                jobId: operation.jobId,
              },
            });
          }
        } else if (input.scope === "history-outbox-replay") {
          if (targetIds.length === 0) {
            const command = createHistoryOutboxIngestBatchCommand(
              {},
              {
                type: "server",
                service: "admin-repair-job",
              },
            );
            queuedOperations.push(
              operationFromEnqueue(await options.jobProducer.enqueue(command)),
            );
          } else {
            for (const target of targetIds) {
              const command = createHistoryOutboxIngestCommand(target, {
                type: "server",
                service: "admin-repair-job",
              });
              queuedOperations.push(
                operationFromEnqueue(
                  await options.jobProducer.enqueue(command),
                ),
              );
            }
          }
        } else if (input.scope === "cdc") {
          const replayRequested =
            targetIds.length === 0 ||
            targetIds.some(isHistoryOutboxReplayTarget);
          if (replayRequested) {
            const command = createHistoryOutboxIngestBatchCommand(
              {},
              {
                type: "server",
                service: "admin-repair-job",
              },
            );
            queuedOperations.push(
              operationFromEnqueue(await options.jobProducer.enqueue(command)),
            );
          }
          const infrastructureTargets = targetIds.filter(
            (target) => !isHistoryOutboxReplayTarget(target),
          );
          if (infrastructureTargets.length > 0) {
            await appendRepairAudit(options, {
              actorUserId: input.actorUserId,
              action: "repair.infrastructure-required",
              targetId: input.scope,
              reason: input.reason,
              correlationId,
              metadata: {
                scope: input.scope,
                targets: infrastructureTargets,
                commands: [
                  ...new Set(
                    infrastructureTargets.map(cdcRepairCommandForTarget),
                  ),
                ],
              },
            });
          }
        } else {
          const failureAudit = await appendRepairAudit(options, {
            actorUserId: input.actorUserId,
            action: "repair.failure",
            targetId: input.scope,
            reason: input.reason,
            correlationId,
            metadata: {
              scope: input.scope,
              dryRunId: input.dryRunId ?? null,
              safeMessage:
                "This repair scope is contract-visible but execution is not implemented.",
            },
          });
          return {
            id: buildId("repair"),
            scope: input.scope,
            status: "failed",
            progress: { completed: 0, total: targetIds.length },
            safeSummary: `${input.scope} repairs do not have a durable job-runner command yet. No mutation was queued.`,
            auditLogId: failureAudit?.id ?? startAudit?.id ?? null,
            dryRunId: input.dryRunId ?? null,
            queuedOperations: [],
            failure: {
              safeMessage:
                "This repair scope is contract-visible but execution is not implemented.",
            },
            createdAt: now,
            updatedAt: now,
          };
        }

        const completionAudit = await appendRepairAudit(options, {
          actorUserId: input.actorUserId,
          action: "repair.completion",
          targetId: queuedOperations[0]?.jobId ?? input.scope,
          reason: input.reason,
          correlationId,
          metadata: {
            scope: input.scope,
            dryRunId: input.dryRunId ?? null,
            queuedOperations,
          },
        });

        const infrastructureTargets =
          input.scope === "cdc"
            ? targetIds.filter((target) => !isHistoryOutboxReplayTarget(target))
            : [];
        const safeSummary =
          infrastructureTargets.length > 0
            ? `${queuedOperations.length} safe downstream repair operation(s) queued. CDC infrastructure target(s) require operator CLI repair: ${[
                ...new Set(
                  infrastructureTargets.map(cdcRepairCommandForTarget),
                ),
              ].join(", ")}.`
            : `${queuedOperations.length} durable repair operation(s) queued. Job-runner retry policy will handle transient failures.`;

        return {
          id: queuedOperations[0]?.jobId ?? buildId("repair"),
          scope: input.scope,
          status: queuedOperations.length > 0 ? "pending" : "succeeded",
          progress: {
            completed: queuedOperations.length > 0 ? 0 : targetIds.length,
            total:
              input.scope === "cdc" && queuedOperations.length === 0
                ? targetIds.length
                : queuedOperations.length,
          },
          safeSummary,
          auditLogId: startAudit?.id ?? completionAudit?.id ?? null,
          dryRunId: input.dryRunId ?? null,
          queuedOperations,
          createdAt: now,
          updatedAt: now,
        };
      } catch (error) {
        const safeMessage = safeFailureMessage(error);
        const failureAudit = await appendRepairAudit(options, {
          actorUserId: input.actorUserId,
          action: "repair.failure",
          targetId: input.scope,
          reason: input.reason,
          correlationId,
          metadata: {
            scope: input.scope,
            dryRunId: input.dryRunId ?? null,
            safeMessage,
            queuedOperations,
          },
        });
        return {
          id: buildId("repair"),
          scope: input.scope,
          status: "failed",
          progress: {
            completed: 0,
            total: targetIds.length,
          },
          safeSummary: safeMessage,
          auditLogId: failureAudit?.id ?? startAudit?.id ?? null,
          dryRunId: input.dryRunId ?? null,
          queuedOperations,
          failure: { safeMessage },
          createdAt: now,
          updatedAt: now,
        };
      }
    },

    async retryOperation(
      input: AdminRepairJobOperationRequest & { actorUserId?: string },
    ): Promise<AdminRepairJobOperationResponse> {
      const correlationId = crypto.randomUUID();
      const operation = await retryFailedJob(
        options,
        `${input.lane}:${input.jobId}`,
      );
      const audit = await appendRepairAudit(options, {
        actorUserId: input.actorUserId,
        action: "repair.retry",
        targetId: input.jobId,
        reason: input.reason,
        correlationId,
        metadata: { lane: input.lane, jobId: input.jobId },
      });
      return {
        operation,
        auditLogId: audit?.id ?? null,
        safeSummary: "Repair operation retry requested.",
      };
    },

    async cancelOperation(
      input: AdminRepairJobOperationRequest & { actorUserId?: string },
    ): Promise<AdminRepairJobOperationResponse> {
      const correlationId = crypto.randomUUID();
      const operation = await discardFailedJob(options, input);
      const audit = await appendRepairAudit(options, {
        actorUserId: input.actorUserId,
        action: "repair.cancel",
        targetId: input.jobId,
        reason: input.reason,
        correlationId,
        metadata: { lane: input.lane, jobId: input.jobId },
      });
      return {
        operation,
        auditLogId: audit?.id ?? null,
        safeSummary: "Repair operation cancel requested.",
      };
    },
  };
}

export const adminRepairJobService = createAdminRepairJobService({
  jobProducer: serverJobProducer,
  database: db,
  fetchImpl: fetch,
  jobRunnerBaseUrl: env.JOB_RUNNER_BASE_URL,
  internalSecret: env.JOB_RUNNER_INTERNAL_SECRET,
  auditService: governanceAuditService,
});

export { createAdminRepairJobService };
