import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { EnqueueResult } from "@rezics/job";
import { EXPECTED_MEILI_INDEX_SCHEMAS } from "../../search/schema";
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
    cdc: {
      detectedIssues: [
        {
          sourceId: "reaction",
          code: "slot_missing",
          message: "replication slot does not exist",
          remediation: "Run task service -- cdc repair --source=reaction.",
        },
      ],
    },
    historyOutbox: {
      pendingWithoutIngestJob: true,
      failed: 1,
      retryReady: 1,
    },
  })),
}));

mock.module("@/db", () => ({
  db: {},
  HistoryOutbox: {
    id: "id",
    status: "status",
    unitId: "unitId",
    createdAt: "createdAt",
  },
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

function historyOutboxDatabase(ids: string[] = []) {
  return {
    select: mock(() => ({
      from: mock(() => ({
        where: mock(() => ({
          orderBy: mock(() => ({
            limit: mock(async () => ids.map((id) => ({ id }))),
          })),
        })),
      })),
    })),
  } as any;
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
      database: historyOutboxDatabase(),
      fetchImpl: fetch,
      jobRunnerBaseUrl: "http://jobs",
      internalSecret: "secret",
      auditService: auditService(),
    });
    const repairableIndexUids = EXPECTED_MEILI_INDEX_SCHEMAS.map(
      (schema) => schema.uid,
    );

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
      "shelf-item",
      "realm",
      "zone",
      "tag",
      "label",
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
      "job-11",
      "job-12",
      "job-13",
    ]);
  });

  test("routes queue failed-job targets to job-runner retry", async () => {
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
      database: historyOutboxDatabase(),
      fetchImpl: fetchImpl as unknown as typeof fetch,
      jobRunnerBaseUrl: "http://jobs",
      internalSecret: "secret",
      auditService: auditService(auditCalls),
    });

    const job = await service.start({
      scope: "queue-failed-job",
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

  test("dry-runs history outbox replay with exact targets and bounded sample", async () => {
    const ids = Array.from({ length: 25 }, (_, index) => `outbox-${index + 1}`);
    const auditCalls: any[] = [];
    const { createAdminRepairJobService } = await import(
      "./admin-repair-job.service"
    );
    const service = createAdminRepairJobService({
      jobProducer: {
        enqueue: mock(async () => {
          throw new Error("unexpected enqueue");
        }),
      },
      database: historyOutboxDatabase(ids),
      fetchImpl: fetch,
      auditService: auditService(auditCalls),
    });

    const dryRun = await service.dryRun({
      scope: "history-outbox-replay",
      historyOutboxStatuses: ["failed"],
      unitId: "unit-1",
      olderThanMinutes: 10,
      limit: 25,
      reason: "replay stuck outbox rows",
      actorUserId: "user-1",
    });

    expect(dryRun.affectedCount).toBe(25);
    expect(dryRun.targetIds).toEqual(ids);
    expect(dryRun.sampleTargets).toEqual(ids.slice(0, 20));
    expect(dryRun.sampleLimited).toBe(true);
    expect(auditCalls[0]).toMatchObject({
      action: "repair.dry-run",
      targetId: "history-outbox-replay",
      metadata: {
        scope: "history-outbox-replay",
        targetCount: 25,
      },
    });
  });

  test("queues history outbox replay through idempotent ingest commands", async () => {
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
            status: enqueued.length === 1 ? "created" : "coalesced",
            jobId: `job-${enqueued.length}`,
          };
        }),
      },
      database: historyOutboxDatabase(),
      fetchImpl: fetch,
      auditService: auditService(),
    });

    const job = await service.start({
      scope: "history-outbox-replay",
      targetIds: ["outbox-1", "outbox-2"],
      dryRunId: "dryrun-1",
      reason: "replay missed outbox rows",
    });

    expect(enqueued.map((command) => command.kind)).toEqual([
      "history.outbox.ingest",
      "history.outbox.ingest",
    ]);
    expect(enqueued.map((command) => command.idempotencyKey)).toEqual([
      "history.outbox.ingest:outbox-1",
      "history.outbox.ingest:outbox-2",
    ]);
    expect(job.queuedOperations).toEqual([
      {
        jobId: "job-1",
        lane: "history.ingest",
        kind: "history.outbox.ingest",
        status: "created",
        idempotencyKey: "history.outbox.ingest:outbox-1",
      },
      {
        jobId: "job-2",
        lane: "history.ingest",
        kind: "history.outbox.ingest",
        status: "coalesced",
        idempotencyKey: "history.outbox.ingest:outbox-2",
      },
    ]);
  });

  test("queues batch history outbox recovery when no exact targets are provided", async () => {
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
            jobId: "job-batch",
          };
        }),
      },
      database: historyOutboxDatabase(),
      fetchImpl: fetch,
      auditService: auditService(),
    });

    const job = await service.start({
      scope: "history-outbox-replay",
      reason: "recover pending history outbox rows",
    });

    expect(enqueued.map((command) => command.kind)).toEqual([
      "history.outbox.ingestBatch",
    ]);
    expect(enqueued[0]).toMatchObject({
      lane: "history.ingest",
      payload: {},
      source: {
        type: "server",
        service: "admin-repair-job",
      },
    });
    expect(job.queuedOperations).toEqual([
      {
        jobId: "job-batch",
        lane: "history.ingest",
        kind: "history.outbox.ingestBatch",
        status: "created",
        idempotencyKey: "history.outbox.ingestBatch",
      },
    ]);
  });

  test("dry-runs CDC issues and includes safe replay target", async () => {
    const { createAdminRepairJobService } = await import(
      "./admin-repair-job.service"
    );
    const service = createAdminRepairJobService({
      jobProducer: {
        enqueue: mock(async () => {
          throw new Error("unexpected enqueue");
        }),
      },
      database: historyOutboxDatabase(),
      fetchImpl: fetch,
      auditService: auditService(),
    });

    const dryRun = await service.dryRun({
      scope: "cdc",
      reason: "diagnose cdc drift",
    });

    expect(dryRun.targetIds).toEqual([
      "reaction:slot_missing",
      "history:outbox-replay",
    ]);
    expect(dryRun.warnings.join("\n")).toContain("task service -- cdc repair");
  });

  test("queues only safe downstream repair for CDC scope", async () => {
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
            jobId: "job-cdc",
          };
        }),
      },
      database: historyOutboxDatabase(),
      fetchImpl: fetch,
      auditService: auditService(),
    });

    const job = await service.start({
      scope: "cdc",
      targetIds: ["reaction:slot_missing", "history:outbox-replay"],
      reason: "recover cdc delivery",
    });

    expect(enqueued.map((command) => command.kind)).toEqual([
      "history.outbox.ingestBatch",
    ]);
    expect(job.safeSummary).toContain(
      "task service -- cdc repair --source=reaction",
    );
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
      database: historyOutboxDatabase(),
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
      database: historyOutboxDatabase(),
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
