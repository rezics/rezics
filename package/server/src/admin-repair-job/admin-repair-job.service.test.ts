import { beforeEach, describe, expect, mock, test } from "bun:test";

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
    workDomains: {
      projectionDrift: [],
      largeDomains: [],
      hiddenWorks: [],
    },
  })),
}));

mock.module("@/job/job-boundary", () => ({
  serverJobProducer: {
    enqueue: mock(async () => ({
      kind: "maintenance.search.rebuildIndex",
      idempotencyKey: "test",
      lane: "maintenance",
      status: "created",
      jobId: "job-default",
    })),
  },
}));

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
        enqueue: mock(async (command: any) => {
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
    });

    const job = await service.start({
      scope: "search",
      targetIds: ["content", "users"],
      dryRunId: "dryrun-1",
      reason: "repair search drift",
    });

    expect(job.status).toBe("pending");
    expect(job.progress).toEqual({ completed: 0, total: 2 });
    expect(enqueued.map((command) => command.payload.index)).toEqual([
      "content",
      "user",
    ]);
    expect(job.queuedOperations?.map((operation) => operation.jobId)).toEqual([
      "job-1",
      "job-2",
    ]);
  });

  test("routes failed history outbox targets to job-runner retry", async () => {
    const fetchImpl = mock(async (url: string, init?: RequestInit) => {
      expect(url).toBe("http://jobs/admin/jobs/failed/search/job-1/retry");
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
    });

    const job = await service.start({
      scope: "history-outbox",
      targetIds: ["search:job-1"],
      reason: "retry failed job",
    });

    expect(job.status).toBe("pending");
    expect(job.queuedOperations).toEqual([
      {
        jobId: "job-1",
        lane: "search",
        kind: "job-runner.failed.retry",
        status: "retried",
        idempotencyKey: null,
      },
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
});
