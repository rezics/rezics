import type {
  AdminRepairJob,
  AdminRepairJobDryRun,
  AdminRepairJobDryRunRequest,
  AdminRepairJobStartRequest,
} from "@rezics/contract";
import { getSystemStatusSummary } from "@/diagnostic";

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

export const adminRepairJobService = {
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
        .map((job) => job.id)
        .filter((id): id is string => Boolean(id));
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

    const uniqueTargets = [...new Set(filterTargets(targets, input.targetIds))];

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

  async start(input: AdminRepairJobStartRequest): Promise<AdminRepairJob> {
    const now = nowIso();
    return {
      id: buildId("repair"),
      scope: input.scope,
      status: "pending",
      progress: {
        completed: 0,
        total: input.targetIds?.length ?? 0,
      },
      safeSummary:
        "Repair job accepted by the admin API contract; durable execution is implemented in the job-runner task.",
      auditLogId: null,
      dryRunId: input.dryRunId ?? null,
      createdAt: now,
      updatedAt: now,
    };
  },
};
