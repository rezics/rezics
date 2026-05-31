import type {
  AdminRepairJob,
  AdminRepairJobDryRun,
  AdminRepairJobDryRunRequest,
  AdminRepairJobOperationRequest,
  AdminRepairJobOperationResponse,
  AdminRepairJobQueuedOperation,
  AdminRepairJobStartRequest,
} from "@rezics/contract";
import {
  createMaintenanceCommand,
  createSearchCommand,
  type EnqueueResult,
  MAINTENANCE_COMMAND_KINDS,
  SEARCH_COMMAND_KINDS,
} from "@rezics/job";
import { getSystemStatusSummary } from "@/diagnostic";
import { env } from "@/env";
import { governanceAuditService } from "@/governance/audit.service";
import { type JobProducer, serverJobProducer } from "@/job/job-boundary";

type RepairJobProducer = Pick<JobProducer, "enqueue">;

type AdminRepairJobServiceOptions = {
  jobProducer: RepairJobProducer;
  fetchImpl: typeof fetch;
  jobRunnerBaseUrl?: string;
  internalSecret?: string;
  auditService: Pick<typeof governanceAuditService, "appendPrivilegedMutation">;
};

const SEARCH_INDEX_REBUILD_TARGETS = {
  content: "content",
  feedbacks: "feedback",
  users: "user",
  posts: "post",
  realms: "realm",
  entities: "entity",
  progress: "progress",
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
    lane: target.slice(0, separator),
    id: target.slice(separator + 1),
  };
}

function jobRunnerUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/+$/, "")}${path}`;
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
      `/admin/jobs/failed/${encodeURIComponent(input.lane)}/${encodeURIComponent(input.jobId)}/discard`,
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
    lane: input.lane,
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
      input: AdminRepairJobDryRunRequest,
    ): Promise<AdminRepairJobDryRun> {
      const system = await getSystemStatusSummary();
      const warnings: string[] = [];
      let targets: string[] = [];

      if (input.scope === "search") {
        targets = system.meili.indexes
          .filter((index) => index.settingsDrift?.hasDrift || !index.exists)
          .map((index) => index.uid);
      } else if (input.scope === "history-outbox") {
        targets = system.queue.failedJobs
          .map((job) => (job.id && job.lane ? `${job.lane}:${job.id}` : null))
          .filter((target): target is string => Boolean(target));
      } else if (input.scope === "work-domain") {
        targets = [
          ...system.workDomains.projectionDrift.flatMap((row) => [
            row.workUnitId,
            row.releaseUnitId,
          ]),
          ...system.workDomains.largeDomains.map((row) => row.workUnitId),
          ...system.workDomains.hiddenWorks.map((row) => row.workUnitId),
        ];
      } else {
        warnings.push(
          `${input.scope} dry-run contract is available; detector implementation is pending.`,
        );
      }

      const uniqueTargets = [
        ...new Set(filterTargets(targets, input.targetIds)),
      ];

      return {
        id: buildId("dryrun"),
        dryRun: true,
        scope: input.scope,
        affectedCount: uniqueTargets.length,
        sampleTargets: uniqueTargets.slice(0, 20),
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
        } else if (input.scope === "history-outbox") {
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
        } else if (input.scope === "work-domain") {
          const command = createSearchCommand(
            SEARCH_COMMAND_KINDS.contentWorkDomainFullSync,
            { limit: 500 },
            { type: "server", service: "admin-repair-job" },
          );
          queuedOperations.push(
            operationFromEnqueue(await options.jobProducer.enqueue(command)),
          );
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

        return {
          id: queuedOperations[0]?.jobId ?? buildId("repair"),
          scope: input.scope,
          status: "pending",
          progress: {
            completed: 0,
            total: queuedOperations.length,
          },
          safeSummary: `${queuedOperations.length} durable repair operation(s) queued. Job-runner retry policy will handle transient failures.`,
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
  fetchImpl: fetch,
  jobRunnerBaseUrl: env.JOB_RUNNER_BASE_URL,
  internalSecret: env.JOB_RUNNER_INTERNAL_SECRET,
  auditService: governanceAuditService,
});

export { createAdminRepairJobService };
