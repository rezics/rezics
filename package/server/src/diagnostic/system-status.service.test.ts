import { describe, expect, mock, test } from "bun:test";
import { EXPECTED_MEILI_INDEX_SCHEMAS } from "@rezics/search";
import { installPrismaClientMock } from "../test/prisma-client-mock";
import type { MeiliStatusSummary } from "./status.types";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/rezics_book";
process.env.AUTH_INTERNAL_BASE_URL ??= "http://localhost:3001";
process.env.AUTH_PUBLIC_BASE_URL ??= "http://localhost:3001";
process.env.AUTH_PUBLIC_ISSUER_URL ??= "http://localhost:3001";
process.env.AUTH_INTERNAL_TOKEN_GATEWAY_SECRET ??= "secret";
process.env.SMTP_HOST ??= "localhost";
process.env.SMTP_USER ??= "smtp";
process.env.SMTP_PASSWORD ??= "smtp";
process.env.TURNSTILE_SECRET ??= "turnstile";
process.env.MEILI_HOST ??= "http://localhost:7700";
process.env.MEILI_MASTER_KEY ??= "masterKey";
process.env.NOTIFY_BASE_URL ??= "http://localhost:3010";
process.env.NOTIFY_INTERNAL_SECRET ??= "notify";
process.env.REACTION_BASE_URL ??= "http://localhost:3011";
process.env.REACTION_INTERNAL_SECRET ??= "reaction";

installPrismaClientMock();

const meiliSummary: MeiliStatusSummary = {
  status: "available",
  checkedAt: "2026-05-25T00:00:00.000Z",
  version: "1.12.0",
  schemas: [...EXPECTED_MEILI_INDEX_SCHEMAS],
  indexes: [],
  tasks: [],
};

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { "content-type": "application/json" },
  });
}

function queryClient(options?: {
  publicationTables?: string[];
  slotActive?: boolean;
  lagBytes?: number;
}) {
  return {
    $queryRawUnsafe: mock(async (query: string) => {
      if (query === "SHOW wal_level") return [{ wal_level: "logical" }];
      if (query.includes("pg_publication")) {
        return (options?.publicationTables ?? ["Unit", "User", "Post"]).map(
          (tablename) => ({ tablename }),
        );
      }
      if (query.includes("pg_replication_slots")) {
        return [
          {
            slot_name: "rezics_sequin_slot_test",
            active: options?.slotActive ?? true,
            confirmed_flush_lsn: "0/16B6C50",
            lag_bytes: options?.lagBytes ?? 0,
          },
        ];
      }
      return [];
    }),
  } as any;
}

describe("getSystemStatusSummary", () => {
  test("keeps partial status when one dependency fails", async () => {
    const { getSystemStatusSummary } = await import("./system-status.service");
    const fetchImpl = mock(async (url: string) => {
      if (url.includes("auth")) throw new Error("token=secret");
      if (url.endsWith("/admin/queues/counts")) {
        return jsonResponse({
          counts: [
            {
              lane: "search",
              created: 1,
              retry: 0,
              active: 0,
              completed: 2,
              cancelled: 0,
              failed: 0,
              all: 3,
            },
          ],
        });
      }
      if (url.includes("/admin/jobs/failed")) return jsonResponse({ jobs: [] });
      return jsonResponse({ status: url.endsWith("/ready") ? "ready" : "ok" });
    });

    const summary = await getSystemStatusSummary({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      queryClient: queryClient({
        publicationTables: [
          "HistoryOutbox",
          "Unit",
          "UnitTranslation",
          "UnitTag",
          "TagVote",
          "UnitAlias",
          "CreditAttribution",
          "SubjectAttribution",
          "UnitRealm",
          "RealmTagApplication",
          "RealmTagUnit",
          "ShelfUnit",
          "Post",
          "User",
          "UserUnitProgress",
          "Feedback",
        ],
      }),
      authHealthUrl: "http://auth/health",
      jobRunnerBaseUrl: "http://jobs",
      sequinHealthUrl: "http://sequin/health",
      meiliSummary,
    });

    expect(summary.services.find((item) => item.id === "auth")?.status).toBe(
      "unavailable",
    );
    expect(summary.queue.item.status).toBe("available");
    expect(JSON.stringify(summary)).not.toContain("secret");
  });

  test("reports CDC degradation for missing publication tables and slot lag", async () => {
    const { getSystemStatusSummary } = await import("./system-status.service");
    const summary = await getSystemStatusSummary({
      fetchImpl: (async () =>
        jsonResponse({ status: "ok" })) as unknown as typeof fetch,
      queryClient: queryClient({
        publicationTables: ["Unit"],
        lagBytes: 999,
      }),
      jobRunnerBaseUrl: undefined,
      sequinHealthUrl: undefined,
      lagWarningBytes: 10,
      meiliSummary,
    });

    expect(summary.cdc.item.status).toBe("degraded");
    expect(summary.cdc.missingTables).toContain("User");
    expect(summary.cdc.lagBytes).toBe(999);
  });

  test("failed jobs degrade queue status with safe metadata", async () => {
    const { getSystemStatusSummary } = await import("./system-status.service");
    const fetchImpl = mock(async (url: string) => {
      if (url.endsWith("/admin/queues/counts")) {
        return jsonResponse({
          counts: [
            {
              lane: "search",
              created: 0,
              retry: 0,
              active: 0,
              completed: 0,
              cancelled: 0,
              failed: 1,
              all: 1,
            },
          ],
        });
      }
      if (url.includes("/admin/jobs/failed")) {
        return jsonResponse({
          jobs: [
            {
              id: "job-1",
              lane: "search",
              state: "failed",
              commandKind: "search.content.sync",
              commandLane: "search",
              attemptCount: 3,
              source: { type: "sequin", table: "Unit" },
            },
          ],
        });
      }
      return jsonResponse({ status: url.endsWith("/ready") ? "ready" : "ok" });
    });

    const summary = await getSystemStatusSummary({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      queryClient: queryClient(),
      jobRunnerBaseUrl: "http://jobs",
      sequinHealthUrl: "http://sequin/health",
      meiliSummary,
    });

    expect(summary.queue.item.status).toBe("degraded");
    expect(summary.queue.failedJobs[0]).toMatchObject({
      id: "job-1",
      commandKind: "search.content.sync",
      attemptCount: 3,
    });
  });
});
