import { describe, expect, mock, test } from "bun:test";
import { EXPECTED_MEILI_INDEX_SCHEMAS } from "@rezics/search";
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
  maxReplicationSlots?: number;
  usedReplicationSlots?: number;
  maxWalSenders?: number;
  activeWalSenders?: number;
  slotExists?: boolean;
  slotActive?: boolean;
  lagBytes?: number;
  historyCounts?: Record<string, number>;
  historyAge?: Record<string, unknown>;
  historyActivity?: Record<string, unknown>;
  historyRecentPending?: Record<string, unknown>[];
  historyRecentFailed?: Record<string, unknown>[];
  historyRetryReadyFailed?: Record<string, unknown>[];
}) {
  return {
    execute: mock(async (query: { queryChunks?: unknown[] }) => {
      const queryText = (query.queryChunks ?? [])
        .map((chunk: any) =>
          Array.isArray(chunk?.value) ? chunk.value.join("") : String(chunk),
        )
        .join("");
      if (queryText.includes("SHOW wal_level")) {
        return { rows: [{ wal_level: "logical" }] };
      }
      if (queryText.includes("SHOW max_replication_slots")) {
        return {
          rows: [
            {
              max_replication_slots: String(options?.maxReplicationSlots ?? 10),
            },
          ],
        };
      }
      if (queryText.includes("SHOW max_wal_senders")) {
        return {
          rows: [{ max_wal_senders: String(options?.maxWalSenders ?? 10) }],
        };
      }
      if (queryText.includes("used_replication_slots")) {
        return {
          rows: [
            {
              used_replication_slots: options?.usedReplicationSlots ?? 1,
            },
          ],
        };
      }
      if (queryText.includes("active_wal_senders")) {
        return {
          rows: [{ active_wal_senders: options?.activeWalSenders ?? 1 }],
        };
      }
      if (queryText.includes("pg_publication")) {
        return {
          rows: (options?.publicationTables ?? ["Unit", "User", "Post"]).map(
            (tablename) => ({ tablename }),
          ),
        };
      }
      if (queryText.includes("pg_replication_slots")) {
        if (options?.slotExists === false) return { rows: [] };
        return {
          rows: [
            {
              slot_name: "rezics_sequin_slot_test",
              active: options?.slotActive ?? true,
              active_pid: 123,
              restart_lsn: "0/16B6C40",
              confirmed_flush_lsn: "0/16B6C50",
              lag_bytes: options?.lagBytes ?? 0,
            },
          ],
        };
      }
      if (queryText.includes('FROM "HistoryOutbox"')) {
        if (queryText.includes("GROUP BY status")) {
          return {
            rows: Object.entries(options?.historyCounts ?? {}).map(
              ([status, count]) => ({ status, count }),
            ),
          };
        }
        if (queryText.includes("pending_under_5m")) {
          return {
            rows: [
              {
                pending_under_5m: 1,
                pending_under_1h: 2,
                pending_under_24h: 3,
                pending_over_24h: 4,
                retry_ready: 5,
                oldest_pending_created_at: "2026-06-05T00:00:00.000Z",
                newest_pending_created_at: "2026-06-05T01:00:00.000Z",
                ...(options?.historyAge ?? {}),
              },
            ],
          };
        }
        if (queryText.includes("recent_created_at")) {
          return {
            rows: [
              {
                recent_created_at: "2026-06-05T02:00:00.000Z",
                recent_processed_at: "2026-06-05T03:00:00.000Z",
                ...(options?.historyActivity ?? {}),
              },
            ],
          };
        }
        if (queryText.includes("WHERE status = 'pending'")) {
          return {
            rows: options?.historyRecentPending ?? [
              {
                id: "pending-1",
                unitId: "unit-1",
                sequence: "10",
                category: "metadata",
                attempts: 0,
                nextAttemptAt: null,
                createdAt: "2026-06-05T04:00:00.000Z",
              },
            ],
          };
        }
        if (
          queryText.includes("WHERE status = 'failed'") &&
          queryText.includes('"nextAttemptAt" IS NULL')
        ) {
          return {
            rows: options?.historyRetryReadyFailed ?? [
              {
                id: "failed-ready-1",
                unitId: "unit-2",
                sequence: "11",
                category: "authority",
                attempts: 2,
                nextAttemptAt: null,
                processedAt: null,
                lastError: "ready",
                createdAt: "2026-06-05T05:00:00.000Z",
              },
            ],
          };
        }
        if (queryText.includes("WHERE status = 'failed'")) {
          return {
            rows: options?.historyRecentFailed ?? [
              {
                id: "failed-1",
                unitId: "unit-3",
                sequence: "12",
                category: "metadata",
                attempts: 3,
                nextAttemptAt: "2026-06-05T06:00:00.000Z",
                processedAt: null,
                lastError: "failure".repeat(80),
                createdAt: "2026-06-05T05:30:00.000Z",
              },
            ],
          };
        }
        return { rows: [] };
      }
      return { rows: [] };
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
          "ShelfItem",
          "Post",
          "ScoreEntry",
          "ScoreAggregate",
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
    expect(summary.cdc.maxReplicationSlots).toBe(10);
    expect(summary.cdc.usedReplicationSlots).toBe(1);
    expect(summary.cdc.availableReplicationSlots).toBe(9);
    expect(summary.cdc.maxWalSenders).toBe(10);
    expect(summary.cdc.activeWalSenders).toBe(1);
    expect(summary.cdc.availableWalSenders).toBe(9);
    expect(summary.cdc.slotActivePid).toBe(123);
    expect(summary.cdc.restartLsn).toBe("0/16B6C40");
  });

  test("reports CDC degradation for extra publication tables and walsender pressure", async () => {
    const { getSystemStatusSummary } = await import("./system-status.service");
    const summary = await getSystemStatusSummary({
      fetchImpl: (async () =>
        jsonResponse({ status: "ok" })) as unknown as typeof fetch,
      queryClient: queryClient({
        publicationTables: ["Unit", "UnexpectedTable"],
        maxWalSenders: 1,
        activeWalSenders: 1,
      }),
      meiliSummary,
    });

    expect(summary.cdc.extraTables).toContain("UnexpectedTable");
    expect(summary.cdc.availableWalSenders).toBe(0);
    expect(summary.cdc.item.reason).toContain("publication 包含未路由資料表");
    expect(summary.cdc.item.reason).toContain("walsender 已無可用容量");
  });

  test("reports CDC degradation for missing or inactive replication slots", async () => {
    const { getSystemStatusSummary } = await import("./system-status.service");
    const missing = await getSystemStatusSummary({
      fetchImpl: (async () =>
        jsonResponse({ status: "ok" })) as unknown as typeof fetch,
      queryClient: queryClient({ slotExists: false }),
      meiliSummary,
    });
    const inactive = await getSystemStatusSummary({
      fetchImpl: (async () =>
        jsonResponse({ status: "ok" })) as unknown as typeof fetch,
      queryClient: queryClient({ slotActive: false }),
      meiliSummary,
    });

    expect(missing.cdc.slotExists).toBe(false);
    expect(missing.cdc.item.reason).toContain("replication slot 不存在");
    expect(inactive.cdc.slotActive).toBe(false);
    expect(inactive.cdc.item.reason).toContain("replication slot 未啟用");
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

  test("degrades history outbox when pending rows have no ingest queue activity", async () => {
    const { getSystemStatusSummary } = await import("./system-status.service");
    const fetchImpl = mock(async (url: string) => {
      if (url.endsWith("/admin/queues/counts")) {
        return jsonResponse({
          counts: [
            {
              lane: "history.ingest",
              created: 0,
              retry: 0,
              active: 0,
              completed: 0,
              cancelled: 0,
              failed: 0,
              all: 0,
            },
          ],
        });
      }
      if (url.includes("/admin/jobs/failed")) return jsonResponse({ jobs: [] });
      return jsonResponse({ status: url.endsWith("/ready") ? "ready" : "ok" });
    });

    const summary = await getSystemStatusSummary({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      queryClient: queryClient({ historyCounts: { pending: 2 } }),
      jobRunnerBaseUrl: "http://jobs",
      sequinHealthUrl: "http://sequin/health",
      meiliSummary,
    });

    expect(summary.historyOutbox.item.status).toBe("degraded");
    expect(summary.historyOutbox.pendingWithoutIngestJob).toBe(true);
    expect(summary.historyOutbox.item.reason).toContain("no history.ingest");
    expect(summary.historyOutbox.pendingAgeBuckets).toEqual({
      under5m: 1,
      under1h: 2,
      under24h: 3,
      over24h: 4,
    });
    expect(summary.historyOutbox.oldestPendingCreatedAt).toBe(
      "2026-06-05T00:00:00.000Z",
    );
    expect(summary.historyOutbox.recentProcessedAt).toBe(
      "2026-06-05T03:00:00.000Z",
    );
    expect(summary.historyOutbox.retryReady).toBe(5);
    expect(summary.historyOutbox.recentPending[0]).toMatchObject({
      id: "pending-1",
      unitId: "unit-1",
      sequence: "10",
    });
    expect(summary.historyOutbox.retryReadyFailed[0]).toMatchObject({
      id: "failed-ready-1",
      lastError: "ready",
    });
    expect(summary.historyOutbox.recentFailed[0]?.lastError?.length).toBe(240);
  });
});
