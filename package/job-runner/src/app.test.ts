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
      enqueued: 1,
      results: [{ kind: "search.content.delete", status: "coalesced" }],
    });
  });
});
