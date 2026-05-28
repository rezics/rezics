import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import {
  adminRepairJobDryRunSchema,
  adminRepairJobOperationRequestSchema,
  adminRepairJobOperationResponseSchema,
  adminRepairJobSchema,
  adminRepairJobStartRequestSchema,
} from "./admin-repair-job";

describe("admin repair job contracts", () => {
  test("accepts dry-run drift summaries", () => {
    expect(
      Value.Check(adminRepairJobDryRunSchema, {
        id: "dryrun-1",
        dryRun: true,
        scope: "search",
        affectedCount: 2,
        sampleTargets: ["books", "users"],
        warnings: [],
        generatedAt: "2026-05-28T00:00:00.000Z",
      }),
    ).toBe(true);
  });

  test("requires reason for repair start requests", () => {
    expect(
      Value.Check(adminRepairJobStartRequestSchema, {
        scope: "work-domain",
        reason: "repair inherited memberships",
        targetIds: ["work-1"],
        dryRunId: "dryrun-1",
      }),
    ).toBe(true);
    expect(
      Value.Check(adminRepairJobStartRequestSchema, {
        scope: "work-domain",
        reason: "",
      }),
    ).toBe(false);
  });

  test("accepts queued repair job status", () => {
    expect(
      Value.Check(adminRepairJobSchema, {
        id: "repair-1",
        scope: "history-outbox",
        status: "pending",
        progress: { completed: 0, total: 3 },
        safeSummary: "Queued for repair.",
        auditLogId: null,
        dryRunId: "dryrun-1",
        queuedOperations: [
          {
            jobId: "job-1",
            lane: "maintenance",
            kind: "maintenance.search.rebuildIndex",
            status: "created",
            idempotencyKey: "maintenance:search:content",
          },
        ],
        createdAt: "2026-05-28T00:00:00.000Z",
        updatedAt: "2026-05-28T00:00:00.000Z",
      }),
    ).toBe(true);
  });

  test("accepts repair operation retry and cancel contracts", () => {
    expect(
      Value.Check(adminRepairJobOperationRequestSchema, {
        lane: "maintenance",
        jobId: "job-1",
        reason: "retry failed repair",
      }),
    ).toBe(true);
    expect(
      Value.Check(adminRepairJobOperationResponseSchema, {
        operation: {
          jobId: "job-1",
          lane: "maintenance",
          kind: "job-runner.failed.retry",
          status: "retried",
          idempotencyKey: null,
        },
        auditLogId: "audit-1",
        safeSummary: "Repair operation retried.",
      }),
    ).toBe(true);
  });
});
