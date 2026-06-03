import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { EnqueueResult } from "@rezics/job";
import { EXPECTED_MEILI_INDEX_SCHEMAS } from "@rezics/search";
import type { GovernanceAuditService } from "@/governance/audit.service";

mock.module("@/env", () => ({
  env: {
    JOB_RUNNER_BASE_URL: "http://jobs",
    JOB_RUNNER_INTERNAL_SECRET: "secret",
  },
}));

mock.module("@/diagnostic", () => ({
  getSystemStatusSummary: mock(async () => ({
    meili: { indexes: [] },
    queue: { failedJobs: [] },
  })),
}));

mock.module("@/job/job-boundary", () => ({
  serverJobProducer: {
    enqueue: mock(
      async (): Promise<EnqueueResult> => ({
        kind: "maintenance.search.rebuildIndex",
        idempotencyKey: "test",
        lane: "maintenance",
        status: "created",
        jobId: "job-default",
      }),
    ),
  },
}));

mock.module("@/governance/audit.service", () => ({
  governanceAuditService: {
    appendPrivilegedMutation: mock(async () => ({ id: "audit-default" })),
  },
}));

function auditService(calls: any[] = []) {
  return {
    appendPrivilegedMutation: mock(async (input: any) => {
      calls.push(input);
      return { id: `audit-${calls.length}` };
    }),
  } as unknown as Pick<GovernanceAuditService, "appendPrivilegedMutation">;
}

describe("adminRepairJobService", () => {
  beforeEach(() => {
    mock.restore();
  });

  test("queues search index repairs through the job producer", async () => {
    const enqueued: any[] = [];
    const { createAdminRepairJobService } = await import(
      "./admin-repair-job.service"
    );
    const service = createAdminRepairJobService({
      jobProducer: {
        enqueue: mock(async (command: any): Promise<EnqueueResult> => {
          enqueued.push(command);
          return {
            kind: command.kind,
            idempotencyKey: command.idempotencyKey,
            lane: command.lane,
            status: "created",
            jobId: `job-${enqueued.length}`,
          };
        }),
      },
      fetchImpl: fetch,
      jobRunnerBaseUrl: "http://jobs",
      internalSecret: "secret",
      auditService: auditService(),
    });
    const repairableIndexUids = EXPECTED_MEILI_INDEX_SCHEMAS.filter(
      (schema) => schema.supportsFullSync !== false,
    ).map((schema) => schema.uid);

    const job = await service.start({
      scope: "search",
      targetIds: repairableIndexUids,
      dryRunId: "dryrun-1",
      reason: "repair search drift",
    });

    expect(job.status).toBe("pending");
    expect(job.progress).toEqual({
      completed: 0,
      total: repairableIndexUids.length,
    });
    expect(enqueued.map((command) => command.payload.index)).toEqual([
      "content",
      "feedback",
      "user",
      "post",
      "comment",
      "poll",
      "collection",
      "realm",
      "entity",
      "progress",
    ]);
    expect(job.queuedOperations?.map((operation) => operation.jobId)).toEqual([
      "job-1",
      "job-2",
      "job-3",
      "job-4",
      "job-5",
      "job-6",
      "job-7",
      "job-8",
      "job-9",
      "job-10",
    ]);
  });

  test("routes failed history outbox targets to job-runner retry", async () => {
    const auditCalls: any[] = [];
    const fetchImpl = mock(async (url: string, init?: RequestInit) => {
      expect(url).toBe(
        "http://jobs/admin/jobs/failed/search.sync.fast/job-1/retry",
      );
      expect(init?.method).toBe("POST");
      expect(init?.headers).toEqual({ "x-internal-secret": "secret" });
      return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
    });
    const { createAdminRepairJobService } = await import(
      "./admin-repair-job.service"
    );
    const service = createAdminRepairJobService({
      jobProducer: {
        enqueue: mock(async () => {
          throw new Error("unexpected enqueue");
        }),
      },
      fetchImpl: fetchImpl as unknown as typeof fetch,
      jobRunnerBaseUrl: "http://jobs",
      internalSecret: "secret",
      auditService: auditService(auditCalls),
    });

    const job = await service.start({
      scope: "history-outbox",
      targetIds: ["search.sync.fast.dead:job-1"],
      reason: "retry failed job",
      actorUserId: "user-1",
    });

    expect(job.status).toBe("pending");
    expect(job.queuedOperations).toEqual([
      {
        jobId: "job-1",
        lane: "search.sync.fast",
        kind: "job-runner.failed.retry",
        status: "retried",
        idempotencyKey: null,
      },
    ]);
    expect(auditCalls.map((call) => call.action)).toEqual([
      "repair.start",
      "repair.retry",
      "repair.completion",
    ]);
  });

  test("returns a safe failed status when a durable command is unavailable", async () => {
    const { createAdminRepairJobService } = await import(
      "./admin-repair-job.service"
    );
    const service = createAdminRepairJobService({
      jobProducer: {
        enqueue: mock(async () => {
          throw new Error("unexpected enqueue");
        }),
      },
      fetchImpl: fetch,
      auditService: auditService(),
    });

    const job = await service.start({
      scope: "slug",
      targetIds: ["slug-1"],
      reason: "repair slug drift",
    });

    expect(job.status).toBe("failed");
    expect(job.queuedOperations).toEqual([]);
    expect(job.failure?.safeMessage).toContain("not implemented");
  });

  test("audits explicit repair operation retry and cancel", async () => {
    const auditCalls: any[] = [];
    const urls: string[] = [];
    const fetchImpl = mock(async (url: string) => {
      urls.push(url);
      return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
    });
    const { createAdminRepairJobService } = await import(
      "./admin-repair-job.service"
    );
    const service = createAdminRepairJobService({
      jobProducer: {
        enqueue: mock(async () => {
          throw new Error("unexpected enqueue");
        }),
      },
      fetchImpl: fetchImpl as unknown as typeof fetch,
      jobRunnerBaseUrl: "http://jobs",
      internalSecret: "secret",
      auditService: auditService(auditCalls),
    });

    const retry = await service.retryOperation({
      lane: "maintenance",
      jobId: "job-1",
      reason: "retry repair job",
      actorUserId: "user-1",
    });
    const cancel = await service.cancelOperation({
      lane: "search.sync.slow.dead",
      jobId: "job-2",
      reason: "cancel repair job",
      actorUserId: "user-1",
    });

    expect(urls).toEqual([
      "http://jobs/admin/jobs/failed/maintenance/job-1/retry",
      "http://jobs/admin/jobs/failed/search.sync.slow/job-2/discard",
    ]);
    expect(retry.operation.status).toBe("retried");
    expect(cancel.operation.status).toBe("cancelled");
    expect(auditCalls.map((call) => call.action)).toEqual([
      "repair.retry",
      "repair.cancel",
    ]);
  });
});
