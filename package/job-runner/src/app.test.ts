import { describe, expect, test } from "bun:test";
import { createSearchCommand, SEARCH_COMMAND_KINDS } from "@rezics/job";
import { createJobRunnerApp } from "./app";
import type { QueueLike } from "./queue/types";

function createMemoryQueue(jobId: string | null = "job-1") {
  const sent: unknown[] = [];
  const queue: QueueLike = {
    async createQueue() {},
    async send(_lane, data) {
      sent.push(data);
      return jobId;
    },
  };
  return { queue, sent };
}

describe("job-runner HTTP app", () => {
  test("rejects enqueue without internal secret", async () => {
    const { queue } = createMemoryQueue();
    const app = createJobRunnerApp({
      queue,
      internalSecret: "secret",
      sequinWebhookSecret: "sequin",
    });

    const response = await app.handle(
      new Request("http://localhost/jobs/enqueue", { method: "POST" }),
    );

    expect(response.status).toBe(401);
  });

  test("validates and enqueues a command", async () => {
    const { queue } = createMemoryQueue("job-1");
    const app = createJobRunnerApp({
      queue,
      internalSecret: "secret",
      sequinWebhookSecret: "sequin",
    });
    const command = createSearchCommand(SEARCH_COMMAND_KINDS.contentPatchTags, {
      unitId: "unit-1",
    });

    const response = await app.handle(
      new Request("http://localhost/jobs/enqueue", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-internal-secret": "secret",
        },
        body: JSON.stringify(command),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      kind: command.kind,
      idempotencyKey: command.idempotencyKey,
      status: "created",
      jobId: "job-1",
    });
  });

  test("rejects malformed enqueue payloads", async () => {
    const { queue } = createMemoryQueue("job-1");
    const app = createJobRunnerApp({
      queue,
      internalSecret: "secret",
      sequinWebhookSecret: "sequin",
    });

    const response = await app.handle(
      new Request("http://localhost/jobs/enqueue", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-internal-secret": "secret",
        },
        body: JSON.stringify({ kind: "unknown" }),
      }),
    );

    expect(response.status).toBe(400);
  });

  test("normalizes coalesced duplicate enqueue", async () => {
    const { queue } = createMemoryQueue(null);
    const app = createJobRunnerApp({
      queue,
      internalSecret: "secret",
      sequinWebhookSecret: "sequin",
    });
    const command = createSearchCommand(SEARCH_COMMAND_KINDS.contentPatchTags, {
      unitId: "unit-1",
    });

    const response = await app.handle(
      new Request("http://localhost/jobs/enqueue", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-internal-secret": "secret",
        },
        body: JSON.stringify(command),
      }),
    );

    expect(await response.json()).toMatchObject({ status: "coalesced" });
  });

  test("rejects Sequin webhook without secret", async () => {
    const { queue } = createMemoryQueue();
    const app = createJobRunnerApp({
      queue,
      internalSecret: "secret",
      sequinWebhookSecret: "sequin",
    });

    const response = await app.handle(
      new Request("http://localhost/webhooks/sequin", { method: "POST" }),
    );

    expect(response.status).toBe(401);
  });

  test("rejects malformed Sequin payloads", async () => {
    const { queue } = createMemoryQueue();
    const app = createJobRunnerApp({
      queue,
      internalSecret: "secret",
      sequinWebhookSecret: "sequin",
    });

    const response = await app.handle(
      new Request("http://localhost/webhooks/sequin", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-internal-secret": "sequin",
        },
        body: JSON.stringify({ bad: true }),
      }),
    );

    expect(response.status).toBe(400);
  });

  test("routes delete payload primary keys and duplicate delivery", async () => {
    const { queue } = createMemoryQueue(null);
    const app = createJobRunnerApp({
      queue,
      internalSecret: "secret",
      sequinWebhookSecret: "sequin",
    });

    const response = await app.handle(
      new Request("http://localhost/webhooks/sequin", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-internal-secret": "sequin",
        },
        body: JSON.stringify({
          table: "Unit",
          action: "delete",
          record_pks: { id: "unit-1" },
          idempotency_key: "seq-1",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: "ok",
      enqueued: 2,
      results: [
        { kind: "search.content.delete", status: "coalesced" },
        { kind: "search.content.syncWorkReleases", status: "coalesced" },
      ],
    });
  });

  test("rejects admin endpoints without internal secret", async () => {
    const { queue } = createMemoryQueue();
    const app = createJobRunnerApp({
      queue,
      internalSecret: "secret",
      sequinWebhookSecret: "sequin",
    });

    const response = await app.handle(
      new Request("http://localhost/admin/queues/counts"),
    );

    expect(response.status).toBe(401);
  });

  test("returns admin queue counts by lane and state", async () => {
    const { queue } = createMemoryQueue();
    const command = createSearchCommand(SEARCH_COMMAND_KINDS.contentPatchTags, {
      unitId: "unit-1",
    });
    const app = createJobRunnerApp({
      queue: {
        ...queue,
        async countStates() {
          return {
            queues: {
              [command.lane]: {
                created: 2,
                retry: 1,
                active: 0,
                completed: 3,
                cancelled: 0,
                failed: 1,
                all: 7,
              },
            },
          };
        },
      },
      internalSecret: "secret",
      sequinWebhookSecret: "sequin",
    });

    const response = await app.handle(
      new Request("http://localhost/admin/queues/counts", {
        headers: { "x-internal-secret": "secret" },
      }),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      counts: Array<Record<string, unknown>>;
    };
    expect(
      body.counts.find((item) => item.lane === command.lane),
    ).toMatchObject({
      lane: command.lane,
      created: 2,
      retry: 1,
      completed: 3,
      failed: 1,
      all: 7,
    });
  });

  test("admin repair endpoints enqueue work-domain search repairs", async () => {
    const { queue, sent } = createMemoryQueue("job-1");
    const app = createJobRunnerApp({
      queue,
      internalSecret: "secret",
      sequinWebhookSecret: "sequin",
    });

    const releaseResponse = await app.handle(
      new Request("http://localhost/admin/search/content/release-1/rebuild", {
        method: "POST",
        headers: { "x-internal-secret": "secret" },
      }),
    );
    const workResponse = await app.handle(
      new Request(
        "http://localhost/admin/search/work-domains/work-1/rebuild?limit=25",
        {
          method: "POST",
          headers: { "x-internal-secret": "secret" },
        },
      ),
    );
    const allResponse = await app.handle(
      new Request(
        "http://localhost/admin/search/work-domains/rebuild-all?limit=25",
        {
          method: "POST",
          headers: { "x-internal-secret": "secret" },
        },
      ),
    );

    expect(releaseResponse.status).toBe(200);
    expect(workResponse.status).toBe(200);
    expect(allResponse.status).toBe(200);
    expect(sent).toMatchObject([
      {
        kind: "search.content.sync",
        payload: { unitId: "release-1" },
      },
      {
        kind: "search.content.syncWorkReleases",
        payload: { targetId: "work-1", limit: 25 },
      },
      {
        kind: "search.content.workDomainFullSync",
        payload: { limit: 25 },
      },
    ]);
  });

  test("lists and inspects failed jobs with command metadata", async () => {
    const { queue } = createMemoryQueue();
    const command = createSearchCommand(SEARCH_COMMAND_KINDS.contentPatchTags, {
      unitId: "unit-1",
    });
    const failedJob = {
      id: "job-failed",
      name: command.lane,
      state: "failed",
      data: command,
      retry_count: 2,
      retry_limit: 5,
      output: {
        value: { message: "boom" },
        meiliTasks: [{ taskUid: 42, index: "content" }],
      },
      created_on: "2026-05-24T00:00:00.000Z",
    };
    const app = createJobRunnerApp({
      queue: {
        ...queue,
        getDb() {
          return {
            async executeSql() {
              return { rows: [failedJob] };
            },
          };
        },
        async getJobById(lane: string, id: string) {
          return lane === command.lane && id === failedJob.id
            ? failedJob
            : null;
        },
      },
      internalSecret: "secret",
      sequinWebhookSecret: "sequin",
    });

    const listResponse = await app.handle(
      new Request("http://localhost/admin/jobs/failed", {
        headers: { "x-internal-secret": "secret" },
      }),
    );
    const inspectResponse = await app.handle(
      new Request(
        `http://localhost/admin/jobs/failed/${command.lane}/${failedJob.id}`,
        { headers: { "x-internal-secret": "secret" } },
      ),
    );

    expect(await listResponse.json()).toMatchObject({
      jobs: [
        {
          id: failedJob.id,
          lane: command.lane,
          commandKind: command.kind,
          idempotencyKey: command.idempotencyKey,
          tags: command.tags,
          source: command.source,
          attemptCount: 2,
          lastError: { message: "boom" },
          meiliTasks: [{ taskUid: 42, index: "content" }],
        },
      ],
    });
    expect(await inspectResponse.json()).toMatchObject({
      job: {
        id: failedJob.id,
        commandKind: command.kind,
      },
    });
  });

  test("retries and discards failed jobs through admin operations", async () => {
    const { queue } = createMemoryQueue();
    const command = createSearchCommand(SEARCH_COMMAND_KINDS.contentPatchTags, {
      unitId: "unit-1",
    });
    const calls: string[] = [];
    const failedJob = { id: "job-failed", name: command.lane, data: command };
    const app = createJobRunnerApp({
      queue: {
        ...queue,
        async getJobById(lane: string, id: string) {
          return lane === command.lane && id === failedJob.id
            ? failedJob
            : null;
        },
        async retry(lane: string, id: string) {
          calls.push(`retry:${lane}:${id}`);
        },
        async deleteJob(lane: string, id: string) {
          calls.push(`delete:${lane}:${id}`);
        },
      },
      internalSecret: "secret",
      sequinWebhookSecret: "sequin",
    });

    await app.handle(
      new Request(
        `http://localhost/admin/jobs/failed/${command.lane}/${failedJob.id}/retry`,
        { method: "POST", headers: { "x-internal-secret": "secret" } },
      ),
    );
    await app.handle(
      new Request(
        `http://localhost/admin/jobs/failed/${command.lane}/${failedJob.id}/discard`,
        { method: "POST", headers: { "x-internal-secret": "secret" } },
      ),
    );

    expect(calls).toEqual([
      `retry:${command.lane}:${failedJob.id}`,
      `delete:${command.lane}:${failedJob.id}`,
    ]);
  });
});
