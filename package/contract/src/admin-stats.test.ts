import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import { adminDashboardSummarySchema } from "./admin-stats";

describe("admin stats contracts", () => {
  test("dashboard summary accepts operations signals", () => {
    expect(
      Value.Check(adminDashboardSummarySchema, {
        checkedAt: "2026-05-28T00:00:00.000Z",
        system: {
          status: "degraded",
          affectedItems: 2,
          link: "/status",
        },
        queue: {
          status: "available",
          lanes: 3,
          activeJobs: 1,
          retryJobs: 0,
          failedJobs: 0,
          link: "/status",
        },
        search: {
          status: "degraded",
          driftedIndexes: 1,
          indexingIndexes: 0,
          failedTasks: 1,
          documentCount: 120,
          link: "/meili",
        },
        governance: {
          openCases: 4,
          escalatedCases: 1,
          realmQueueOpen: 3,
          realmQueueEscalated: 1,
          activeEnforcements: 2,
          link: "/realm",
        },
        audit: {
          recent: [
            {
              id: "audit-1",
              action: "account.ban",
              targetKind: "user",
              targetId: "user-1",
              actorUserId: "staff-1",
              decisionCode: "ALLOWED",
              createdAt: "2026-05-28T00:00:00.000Z",
              link: "/realm?auditLogId=audit-1",
            },
          ],
          link: "/realm",
        },
        repairWarnings: [
          {
            id: "search-settings-drift",
            severity: "warning",
            title: "Search index settings drift detected",
            description: "1 Meili index settings need review.",
            source: "search",
            count: 1,
            link: "/meili",
          },
        ],
      }),
    ).toBe(true);
  });
});
