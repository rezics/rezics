import { REACTION_SEQUIN_TABLES, SOURCE_SEQUIN_TABLES } from "@rezics/job";
import { type SQL, sql } from "drizzle-orm";
import { db } from "../db/client";
import { createServerDb } from "../db/factory";
import { env } from "../env";
import type {
  CdcDetectedIssue,
  CdcIssueCode,
  CdcSourceStatus,
  CdcStatus,
  FailedJobSummary,
  HistoryOutboxStatus,
  QueueStateCounts,
  QueueStatus,
  StatusItem,
  StatusLink,
  StatusState,
  SystemStatusSummary,
} from "./status.types";

type MeiliStatusSummary = Awaited<
  ReturnType<typeof import("../meili/status.service").getMeiliStatusSummary>
>;

const DEFAULT_TIMEOUT_MS = 2_500;
const DEFAULT_LAG_WARNING_BYTES = 256 * 1024 * 1024;

type FetchLike = typeof fetch;

interface QueryClient {
  execute(query: SQL): Promise<{ rows: unknown[] }>;
}

async function queryRows<T>(
  queryClient: QueryClient,
  query: SQL,
): Promise<T[]> {
  const result = await queryClient.execute(query);
  return result.rows as T[];
}

function checkedAt() {
  return new Date().toISOString();
}

function timeout<T>(promise: Promise<T>, timeoutMs = DEFAULT_TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(
        () => reject(new Error("Timed out while checking service")),
        timeoutMs,
      );
    }),
  ]);
}

function safeFailureReason(error: unknown) {
  if (error instanceof Error && /timed out/i.test(error.message)) {
    return error.message;
  }
  return "Status check failed";
}

function joinUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

function statusFromParts(parts: StatusState[]): StatusState {
  if (parts.includes("unavailable")) return "unavailable";
  if (parts.includes("degraded")) return "degraded";
  if (parts.includes("unknown")) return "unknown";
  return "available";
}

function statusLink(id: string, label: string, url?: string): StatusLink {
  return url
    ? { id, label, status: "available", url }
    : { id, label, status: "unknown", reason: "未設定" };
}

async function fetchStatusItem(options: {
  id: string;
  label: string;
  url?: string;
  fetchImpl: FetchLike;
  timeoutMs: number;
  headers?: HeadersInit;
  okStatuses?: string[];
  notConfiguredReason?: string;
}): Promise<StatusItem> {
  const base = {
    id: options.id,
    label: options.label,
    checkedAt: checkedAt(),
    url: options.url,
  };
  if (!options.url) {
    return {
      ...base,
      status: "unknown",
      reason: options.notConfiguredReason ?? "未設定",
    };
  }

  try {
    const response = await timeout(
      options.fetchImpl(options.url, { headers: options.headers }),
      options.timeoutMs,
    );
    if (!response.ok) {
      return {
        ...base,
        status: "unavailable",
        reason: `HTTP ${response.status}`,
      };
    }

    const body = await response.json().catch(() => ({}));
    const status = typeof body?.status === "string" ? body.status : "ok";
    const okStatuses = options.okStatuses ?? ["ok", "ready", "available"];
    return {
      ...base,
      status: okStatuses.includes(status) ? "available" : "degraded",
      reason: okStatuses.includes(status) ? undefined : `狀態為 ${status}`,
    };
  } catch (error) {
    return {
      ...base,
      status: "unavailable",
      reason: safeFailureReason(error),
    };
  }
}

function normalizeCounts(value: unknown): QueueStateCounts[] {
  const counts = (value as { counts?: unknown })?.counts;
  if (!Array.isArray(counts)) return [];
  return counts.map((entry: Record<string, unknown>) => ({
    lane: String(entry.lane ?? "unknown"),
    created: Number(entry.created ?? 0),
    retry: Number(entry.retry ?? 0),
    active: Number(entry.active ?? 0),
    completed: Number(entry.completed ?? 0),
    cancelled: Number(entry.cancelled ?? 0),
    failed: Number(entry.failed ?? 0),
    all: Number(entry.all ?? 0),
  }));
}

function normalizeFailedJobs(value: unknown): FailedJobSummary[] {
  const jobs = (value as { jobs?: unknown })?.jobs;
  if (!Array.isArray(jobs)) return [];
  return jobs.map((job: Record<string, unknown>) => ({
    id: typeof job.id === "string" ? job.id : null,
    lane: typeof job.lane === "string" ? job.lane : null,
    state: typeof job.state === "string" ? job.state : null,
    commandKind: typeof job.commandKind === "string" ? job.commandKind : null,
    commandLane: typeof job.commandLane === "string" ? job.commandLane : null,
    attemptCount: Number(job.attemptCount ?? 0),
    createdAt: typeof job.createdAt === "string" ? job.createdAt : null,
    startedAt: typeof job.startedAt === "string" ? job.startedAt : null,
    completedAt: typeof job.completedAt === "string" ? job.completedAt : null,
    source: job.source ?? null,
  }));
}

async function getQueueStatus(options: {
  fetchImpl: FetchLike;
  timeoutMs: number;
  jobRunnerBaseUrl?: string;
  internalSecret?: string;
}): Promise<QueueStatus> {
  if (!options.jobRunnerBaseUrl) {
    return {
      item: {
        id: "job-runner-queues",
        label: "Job-runner 佇列",
        status: "unknown",
        checkedAt: checkedAt(),
        reason: "JOB_RUNNER_BASE_URL 未設定",
      },
      counts: [],
      failedJobs: [],
    };
  }

  const headers = options.internalSecret
    ? { "x-internal-secret": options.internalSecret }
    : undefined;

  try {
    const [countsResponse, failedResponse] = await Promise.all([
      timeout(
        options.fetchImpl(
          joinUrl(options.jobRunnerBaseUrl, "/admin/queues/counts"),
          { headers },
        ),
        options.timeoutMs,
      ),
      timeout(
        options.fetchImpl(
          joinUrl(options.jobRunnerBaseUrl, "/admin/jobs/failed?limit=20"),
          { headers },
        ),
        options.timeoutMs,
      ),
    ]);

    if (!countsResponse.ok || !failedResponse.ok) {
      return {
        item: {
          id: "job-runner-queues",
          label: "Job-runner 佇列",
          status: "unavailable",
          checkedAt: checkedAt(),
          url: options.jobRunnerBaseUrl,
          reason: "佇列管理端點無法讀取",
        },
        counts: [],
        failedJobs: [],
      };
    }

    const counts = normalizeCounts(await countsResponse.json());
    const failedJobs = normalizeFailedJobs(await failedResponse.json());
    return {
      item: {
        id: "job-runner-queues",
        label: "Job-runner 佇列",
        status: failedJobs.length > 0 ? "degraded" : "available",
        checkedAt: checkedAt(),
        url: options.jobRunnerBaseUrl,
        reason: failedJobs.length > 0 ? "有失敗工作需要處理" : undefined,
      },
      counts,
      failedJobs,
    };
  } catch (error) {
    return {
      item: {
        id: "job-runner-queues",
        label: "Job-runner 佇列",
        status: "unavailable",
        checkedAt: checkedAt(),
        url: options.jobRunnerBaseUrl,
        reason: safeFailureReason(error),
      },
      counts: [],
      failedJobs: [],
    };
  }
}

function envName() {
  return env.NODE_ENV ?? "development";
}

function defaultPublicationName() {
  return `rezics_sequin_pub_${envName()}`;
}

function defaultSlotName() {
  return `rezics_sequin_slot_${envName()}`;
}

function defaultReactionPublicationName() {
  return `rezics_reaction_sequin_pub_${envName()}`;
}

function defaultReactionSlotName() {
  return `rezics_reaction_sequin_slot_${envName()}`;
}

type CdcSourceOptions = {
  id: string;
  label: string;
  queryClient?: QueryClient | null;
  timeoutMs: number;
  trackedTables: readonly string[];
  publicationName: string;
  slotName: string;
  lagWarningBytes: number;
  unconfiguredReason?: string;
};

function cdcIssue(
  source: CdcSourceOptions,
  code: CdcIssueCode,
  message: string,
  remediation?: string,
): CdcDetectedIssue {
  return { sourceId: source.id, code, message, remediation };
}

async function getCdcSourceStatus(
  options: CdcSourceOptions,
): Promise<CdcSourceStatus> {
  const base = {
    id: options.id,
    label: options.label,
    routedTables: [...options.trackedTables],
    publicationTables: [],
    missingTables: [...options.trackedTables],
    publicationName: options.publicationName,
    slotName: options.slotName,
  };

  if (!options.queryClient) {
    const issue = cdcIssue(
      options,
      "source_unconfigured",
      options.unconfiguredReason ?? "CDC diagnostic database is not configured",
      "Set the source diagnostic database URL or verify it with task service -- cdc verify.",
    );
    return {
      item: {
        id: `cdc-${options.id}`,
        label: options.label,
        status: "unknown",
        checkedAt: checkedAt(),
        reason: issue.message,
        remediation: issue.remediation,
      },
      ...base,
      detectedIssues: [issue],
    };
  }

  try {
    const [
      walRows,
      maxSlotRows,
      usedSlotRows,
      maxWalSenderRows,
      activeWalSenderRows,
      publicationRows,
      slotRows,
    ] = await Promise.all([
      timeout(
        queryRows<{ wal_level: string }>(
          options.queryClient,
          sql`SHOW wal_level`,
        ),
        options.timeoutMs,
      ),
      timeout(
        queryRows<{ max_replication_slots: string }>(
          options.queryClient,
          sql`SHOW max_replication_slots`,
        ),
        options.timeoutMs,
      ),
      timeout(
        queryRows<{ used_replication_slots: number }>(
          options.queryClient,
          sql`SELECT COUNT(*)::int AS used_replication_slots
             FROM pg_replication_slots`,
        ),
        options.timeoutMs,
      ),
      timeout(
        queryRows<{ max_wal_senders: string }>(
          options.queryClient,
          sql`SHOW max_wal_senders`,
        ),
        options.timeoutMs,
      ),
      timeout(
        queryRows<{ active_wal_senders: number }>(
          options.queryClient,
          sql`SELECT COUNT(*)::int AS active_wal_senders
             FROM pg_stat_replication`,
        ),
        options.timeoutMs,
      ),
      timeout(
        queryRows<{ tablename: string }>(
          options.queryClient,
          sql`SELECT c.relname AS tablename
           FROM pg_publication p
           JOIN pg_publication_rel pr ON pr.prpubid = p.oid
           JOIN pg_class c ON c.oid = pr.prrelid
           WHERE p.pubname = ${options.publicationName}`,
        ),
        options.timeoutMs,
      ),
      timeout(
        queryRows<{
          slot_name: string;
          active: boolean | null;
          active_pid: number | null;
          restart_lsn: string | null;
          confirmed_flush_lsn: string | null;
          lag_bytes: bigint | number | null;
        }>(
          options.queryClient,
          sql`SELECT slot_name, active, active_pid, restart_lsn::text AS restart_lsn,
                  confirmed_flush_lsn::text AS confirmed_flush_lsn,
                  pg_wal_lsn_diff(pg_current_wal_lsn(), confirmed_flush_lsn)::bigint AS lag_bytes
           FROM pg_replication_slots
           WHERE slot_name = ${options.slotName}`,
        ),
        options.timeoutMs,
      ),
    ]);

    const walLevel = walRows[0]?.wal_level ?? null;
    const publicationTables = publicationRows.map((row) => row.tablename);
    const missingTables = options.trackedTables.filter(
      (table) => !publicationTables.includes(table),
    );
    const extraTables = publicationTables.filter(
      (table) => !options.trackedTables.includes(table),
    );
    const slot = slotRows[0];
    const lagBytes =
      typeof slot?.lag_bytes === "bigint"
        ? Number(slot.lag_bytes)
        : (slot?.lag_bytes ?? null);
    const maxReplicationSlots = Number(
      maxSlotRows[0]?.max_replication_slots ?? Number.NaN,
    );
    const usedReplicationSlots =
      usedSlotRows[0]?.used_replication_slots ?? null;
    const availableReplicationSlots =
      Number.isFinite(maxReplicationSlots) && usedReplicationSlots !== null
        ? Math.max(maxReplicationSlots - usedReplicationSlots, 0)
        : null;
    const maxWalSenders = Number(
      maxWalSenderRows[0]?.max_wal_senders ?? Number.NaN,
    );
    const activeWalSenders = activeWalSenderRows[0]?.active_wal_senders ?? null;
    const availableWalSenders =
      Number.isFinite(maxWalSenders) && activeWalSenders !== null
        ? Math.max(maxWalSenders - activeWalSenders, 0)
        : null;

    const issues = [
      walLevel !== "logical"
        ? cdcIssue(
            options,
            "wal_level_not_logical",
            "wal_level is not logical",
            "Run task service -- cdc repair, restart Postgres if requested, then verify again.",
          )
        : null,
      publicationRows.length === 0
        ? cdcIssue(
            options,
            "publication_missing",
            "publication does not exist or has no tables",
            "Run task service -- cdc repair for this source.",
          )
        : null,
      missingTables.length > 0
        ? cdcIssue(
            options,
            "publication_missing_tables",
            "publication is missing routed tables",
            "Run task service -- cdc repair for this source.",
          )
        : null,
      extraTables.length > 0
        ? cdcIssue(
            options,
            "publication_extra_tables",
            "publication includes unrouted tables",
            "Review the publication with task service -- cdc verify.",
          )
        : null,
      !slot
        ? cdcIssue(
            options,
            "slot_missing",
            "replication slot does not exist",
            "Run task service -- cdc repair for this source.",
          )
        : null,
      slot && slot.active === false
        ? cdcIssue(
            options,
            "slot_inactive",
            "replication slot is inactive",
            "Confirm Sequin is running and the source configuration references this slot.",
          )
        : null,
      typeof lagBytes === "number" && lagBytes > options.lagWarningBytes
        ? cdcIssue(
            options,
            "slot_lag_high",
            "replication slot lag is high",
            "Check Sequin delivery and job-runner ingest throughput before replaying downstream queues.",
          )
        : null,
      availableWalSenders !== null && availableWalSenders <= 0
        ? cdcIssue(
            options,
            "wal_senders_exhausted",
            "no WAL sender capacity is available",
            "Stop duplicate Sequin consumers or increase max_wal_senders, then restart Postgres if required.",
          )
        : null,
    ].filter((issue): issue is CdcDetectedIssue => Boolean(issue));

    return {
      item: {
        id: `cdc-${options.id}`,
        label: options.label,
        status: issues.length > 0 ? "degraded" : "available",
        checkedAt: checkedAt(),
        reason: issues.map((issue) => issue.message).join("; ") || undefined,
        remediation: issues[0]?.remediation,
      },
      ...base,
      walLevel,
      publicationExists: publicationRows.length > 0,
      publicationTables,
      missingTables,
      extraTables,
      slotExists: Boolean(slot),
      slotActive: slot?.active ?? null,
      slotActivePid: slot?.active_pid ?? null,
      restartLsn: slot?.restart_lsn ?? null,
      maxReplicationSlots: Number.isFinite(maxReplicationSlots)
        ? maxReplicationSlots
        : null,
      usedReplicationSlots,
      availableReplicationSlots,
      maxWalSenders: Number.isFinite(maxWalSenders) ? maxWalSenders : null,
      activeWalSenders,
      availableWalSenders,
      confirmedFlushLsn: slot?.confirmed_flush_lsn ?? null,
      lagBytes,
      detectedIssues: issues,
    };
  } catch (error) {
    return {
      item: {
        id: `cdc-${options.id}`,
        label: options.label,
        status: "unknown",
        checkedAt: checkedAt(),
        reason: safeFailureReason(error),
      },
      ...base,
      detectedIssues: [],
    };
  }
}

function mergeCdcStatus(sources: CdcSourceStatus[]): CdcStatus {
  const primary = sources[0];
  const status = statusFromParts(sources.map((source) => source.item.status));
  const detectedIssues = sources.flatMap((source) => source.detectedIssues);
  const reason = sources
    .filter((source) => source.item.reason)
    .map((source) => `${source.label}: ${source.item.reason}`)
    .join("; ");

  return {
    ...primary,
    item: {
      id: "cdc",
      label: "Sequin CDC",
      status,
      checkedAt: checkedAt(),
      reason: reason || undefined,
      remediation: detectedIssues[0]?.remediation,
    },
    id: "cdc",
    label: "Sequin CDC",
    routedTables: sources.flatMap((source) => source.routedTables),
    publicationTables: sources.flatMap((source) =>
      source.publicationTables.map((table) => `${source.id}:${table}`),
    ),
    missingTables: sources.flatMap((source) =>
      source.missingTables.map((table) => `${source.id}:${table}`),
    ),
    extraTables: sources.flatMap((source) =>
      (source.extraTables ?? []).map((table) => `${source.id}:${table}`),
    ),
    detectedIssues,
    sources,
  };
}

async function getCdcStatus(options: {
  queryClient: QueryClient;
  timeoutMs: number;
  reactionQueryClient?: QueryClient | null;
  publicationName?: string;
  slotName?: string;
  reactionPublicationName?: string;
  reactionSlotName?: string;
  lagWarningBytes?: number;
}): Promise<CdcStatus> {
  const lagWarningBytes = options.lagWarningBytes ?? DEFAULT_LAG_WARNING_BYTES;
  const sources = await Promise.all([
    getCdcSourceStatus({
      id: "source",
      label: "Server source CDC",
      queryClient: options.queryClient,
      timeoutMs: options.timeoutMs,
      trackedTables: SOURCE_SEQUIN_TABLES,
      publicationName: options.publicationName ?? defaultPublicationName(),
      slotName: options.slotName ?? defaultSlotName(),
      lagWarningBytes,
    }),
    getCdcSourceStatus({
      id: "reaction",
      label: "Reaction CDC",
      queryClient: options.reactionQueryClient,
      timeoutMs: options.timeoutMs,
      trackedTables: REACTION_SEQUIN_TABLES,
      publicationName:
        options.reactionPublicationName ?? defaultReactionPublicationName(),
      slotName: options.reactionSlotName ?? defaultReactionSlotName(),
      lagWarningBytes,
      unconfiguredReason: "STATUS_REACTION_DATABASE_URL is not configured",
    }),
  ]);

  return mergeCdcStatus(sources);
}

function numberField(row: Record<string, unknown>, key: string) {
  return Number(row[key] ?? 0);
}

function stringField(row: Record<string, unknown>, key: string) {
  const value = row[key];
  return typeof value === "string" ? value : String(value ?? "");
}

function isoField(row: Record<string, unknown>, key: string) {
  const value = row[key];
  if (value instanceof Date) return value.toISOString();
  return typeof value === "string" ? value : null;
}

function mapHistoryOutboxSummary(row: Record<string, unknown>) {
  return {
    id: stringField(row, "id"),
    unitId: stringField(row, "unitId"),
    sequence: stringField(row, "sequence"),
    category: stringField(row, "category"),
    attempts: numberField(row, "attempts"),
    nextAttemptAt: isoField(row, "nextAttemptAt"),
    processedAt: isoField(row, "processedAt"),
    lastError:
      typeof row.lastError === "string" ? row.lastError.slice(0, 240) : null,
    createdAt: isoField(row, "createdAt"),
  };
}

function hasHistoryIngestQueueActivity(queue: QueueStatus): boolean {
  const hasQueuedOrActiveIngest = queue.counts.some(
    (row) =>
      row.lane === "history.ingest" && row.created + row.retry + row.active > 0,
  );
  if (hasQueuedOrActiveIngest) return true;
  return queue.failedJobs.some(
    (job) => job.commandKind === "history.outbox.ingest",
  );
}

function correlateHistoryOutboxWithQueue(
  historyOutbox: HistoryOutboxStatus,
  queue: QueueStatus,
): HistoryOutboxStatus {
  if (
    historyOutbox.pending === 0 ||
    queue.item.status === "unknown" ||
    queue.item.status === "unavailable" ||
    hasHistoryIngestQueueActivity(queue)
  ) {
    return historyOutbox;
  }

  const reason = "HistoryOutbox has pending rows but no history.ingest work";
  return {
    ...historyOutbox,
    pendingWithoutIngestJob: true,
    item: {
      ...historyOutbox.item,
      status: "degraded",
      reason: historyOutbox.item.reason
        ? `${historyOutbox.item.reason}; ${reason}`
        : reason,
      remediation:
        historyOutbox.item.remediation ??
        "Check Sequin delivery and replay missed HistoryOutbox rows.",
    },
  };
}

async function getHistoryOutboxStatus(options: {
  queryClient: QueryClient;
  timeoutMs: number;
}): Promise<HistoryOutboxStatus> {
  try {
    const [
      countRows,
      ageRows,
      activityRows,
      recentPendingRows,
      recentFailedRows,
      retryReadyFailedRows,
    ] = await timeout(
      Promise.all([
        queryRows<Record<string, unknown>>(
          options.queryClient,
          sql`SELECT status, COUNT(*)::int AS count
           FROM "HistoryOutbox"
           GROUP BY status
           ORDER BY status ASC`,
        ),
        queryRows<Record<string, unknown>>(
          options.queryClient,
          sql`SELECT
                  COUNT(*) FILTER (
                    WHERE status = 'pending'
                      AND "createdAt" >= now() - interval '5 minutes'
                  )::int AS pending_under_5m,
                  COUNT(*) FILTER (
                    WHERE status = 'pending'
                      AND "createdAt" >= now() - interval '1 hour'
                      AND "createdAt" < now() - interval '5 minutes'
                  )::int AS pending_under_1h,
                  COUNT(*) FILTER (
                    WHERE status = 'pending'
                      AND "createdAt" >= now() - interval '24 hours'
                      AND "createdAt" < now() - interval '1 hour'
                  )::int AS pending_under_24h,
                  COUNT(*) FILTER (
                    WHERE status = 'pending'
                      AND "createdAt" < now() - interval '24 hours'
                  )::int AS pending_over_24h,
                  MIN("createdAt") FILTER (WHERE status = 'pending') AS oldest_pending_created_at,
                  MAX("createdAt") FILTER (WHERE status = 'pending') AS newest_pending_created_at,
                  COUNT(*) FILTER (
                    WHERE status IN ('pending', 'failed')
                      AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= now())
                  )::int AS retry_ready
           FROM "HistoryOutbox"`,
        ),
        queryRows<Record<string, unknown>>(
          options.queryClient,
          sql`SELECT
                  MAX("createdAt") AS recent_created_at,
                  MAX("processedAt") AS recent_processed_at
           FROM "HistoryOutbox"`,
        ),
        queryRows<Record<string, unknown>>(
          options.queryClient,
          sql`SELECT id, "unitId", sequence::text AS sequence, category, status,
                  attempts, "nextAttemptAt", "processedAt", "lastError", "createdAt"
           FROM "HistoryOutbox"
           WHERE status = 'pending'
           ORDER BY "createdAt" DESC
           LIMIT 10`,
        ),
        queryRows<Record<string, unknown>>(
          options.queryClient,
          sql`SELECT id, "unitId", sequence::text AS sequence, category, status,
                  attempts, "nextAttemptAt", "processedAt", "lastError", "createdAt"
           FROM "HistoryOutbox"
           WHERE status = 'failed'
           ORDER BY "updatedAt" DESC
           LIMIT 10`,
        ),
        queryRows<Record<string, unknown>>(
          options.queryClient,
          sql`SELECT id, "unitId", sequence::text AS sequence, category, status,
                  attempts, "nextAttemptAt", "processedAt", "lastError", "createdAt"
           FROM "HistoryOutbox"
           WHERE status = 'failed'
             AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= now())
           ORDER BY "createdAt" ASC
           LIMIT 10`,
        ),
      ]),
      options.timeoutMs,
    );

    const counts = Object.fromEntries(
      countRows.map((row) => [
        stringField(row, "status"),
        numberField(row, "count"),
      ]),
    );
    const pending = counts.pending ?? 0;
    const failed = counts.failed ?? 0;
    const processing = counts.processing ?? 0;
    const completed = counts.completed ?? 0;
    const age = ageRows[0] ?? {};
    const activity = activityRows[0] ?? {};
    const retryReady = numberField(age, "retry_ready");

    return {
      item: {
        id: "history-outbox",
        label: "History outbox",
        status: failed > 0 ? "degraded" : "available",
        checkedAt: checkedAt(),
        reason: failed > 0 ? "有失敗的歷史同步 outbox 記錄" : undefined,
        remediation:
          failed > 0 ? "使用修復工作重試 failed HistoryOutbox rows" : undefined,
      },
      counts,
      pendingAgeBuckets: {
        under5m: numberField(age, "pending_under_5m"),
        under1h: numberField(age, "pending_under_1h"),
        under24h: numberField(age, "pending_under_24h"),
        over24h: numberField(age, "pending_over_24h"),
      },
      pending,
      failed,
      processing,
      completed,
      retryReady,
      oldestPendingCreatedAt: isoField(age, "oldest_pending_created_at"),
      newestPendingCreatedAt: isoField(age, "newest_pending_created_at"),
      recentCreatedAt: isoField(activity, "recent_created_at"),
      recentProcessedAt: isoField(activity, "recent_processed_at"),
      recentPending: recentPendingRows.map((row) => {
        const mapped = mapHistoryOutboxSummary(row);
        return {
          id: mapped.id,
          unitId: mapped.unitId,
          sequence: mapped.sequence,
          category: mapped.category,
          attempts: mapped.attempts,
          nextAttemptAt: mapped.nextAttemptAt,
          createdAt: mapped.createdAt,
        };
      }),
      recentFailed: recentFailedRows.map(mapHistoryOutboxSummary),
      retryReadyFailed: retryReadyFailedRows.map(mapHistoryOutboxSummary),
    };
  } catch (error) {
    return {
      item: {
        id: "history-outbox",
        label: "History outbox",
        status: "unavailable",
        checkedAt: checkedAt(),
        reason: safeFailureReason(error),
      },
      counts: {},
      pendingAgeBuckets: {
        under5m: 0,
        under1h: 0,
        under24h: 0,
        over24h: 0,
      },
      pending: 0,
      failed: 0,
      processing: 0,
      completed: 0,
      retryReady: 0,
      oldestPendingCreatedAt: null,
      newestPendingCreatedAt: null,
      recentCreatedAt: null,
      recentProcessedAt: null,
      recentPending: [],
      recentFailed: [],
      retryReadyFailed: [],
    };
  }
}

export async function getSystemStatusSummary(options?: {
  fetchImpl?: FetchLike;
  queryClient?: QueryClient;
  timeoutMs?: number;
  jobRunnerBaseUrl?: string;
  jobRunnerInternalSecret?: string;
  sequinHealthUrl?: string;
  sequinUiUrl?: string;
  authHealthUrl?: string;
  publicationName?: string;
  slotName?: string;
  reactionQueryClient?: QueryClient | null;
  reactionPublicationName?: string;
  reactionSlotName?: string;
  lagWarningBytes?: number;
  meiliSummary?: MeiliStatusSummary;
}): Promise<SystemStatusSummary> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const jobRunnerBaseUrl =
    options?.jobRunnerBaseUrl ??
    env.STATUS_JOB_RUNNER_URL ??
    env.JOB_RUNNER_BASE_URL;
  const sequinHealthUrl =
    options?.sequinHealthUrl ?? env.STATUS_SEQUIN_HEALTH_URL;
  const authHealthUrl =
    options?.authHealthUrl ??
    (env.STATUS_AUTH_HEALTH_URL ||
      (env.AUTH_PUBLIC_BASE_URL
        ? joinUrl(env.AUTH_PUBLIC_BASE_URL, "/health")
        : undefined));
  const externalReactionDb =
    options?.reactionQueryClient === undefined &&
    env.STATUS_REACTION_DATABASE_URL
      ? createServerDb(env.STATUS_REACTION_DATABASE_URL, 2)
      : null;
  const reactionQueryClient =
    options?.reactionQueryClient ?? externalReactionDb?.db ?? null;

  const [
    meili,
    authService,
    jobRunnerHealth,
    jobRunnerReady,
    sequin,
    queue,
    cdc,
    historyOutbox,
  ] = await Promise.all([
    options?.meiliSummary
      ? Promise.resolve(options.meiliSummary)
      : import("../meili/status.service").then(({ getMeiliStatusSummary }) =>
          getMeiliStatusSummary({ timeoutMs }),
        ),
    fetchStatusItem({
      id: "auth",
      label: "Auth 服務",
      url: authHealthUrl,
      fetchImpl,
      timeoutMs,
    }),
    fetchStatusItem({
      id: "job-runner-health",
      label: "Job-runner HTTP",
      url: jobRunnerBaseUrl ? joinUrl(jobRunnerBaseUrl, "/health") : undefined,
      fetchImpl,
      timeoutMs,
    }),
    fetchStatusItem({
      id: "job-runner-ready",
      label: "Job-runner worker",
      url: jobRunnerBaseUrl ? joinUrl(jobRunnerBaseUrl, "/ready") : undefined,
      fetchImpl,
      timeoutMs,
      okStatuses: ["ready"],
    }),
    fetchStatusItem({
      id: "sequin",
      label: "Sequin",
      url: sequinHealthUrl,
      fetchImpl,
      timeoutMs,
      notConfiguredReason: "SEQUIN_HEALTH_URL 未設定",
    }),
    getQueueStatus({
      fetchImpl,
      timeoutMs,
      jobRunnerBaseUrl,
      internalSecret:
        options?.jobRunnerInternalSecret ?? env.JOB_RUNNER_INTERNAL_SECRET,
    }),
    getCdcStatus({
      queryClient: options?.queryClient ?? db,
      reactionQueryClient,
      timeoutMs,
      publicationName:
        options?.publicationName ?? env.STATUS_CDC_PUBLICATION_NAME,
      slotName: options?.slotName ?? env.STATUS_CDC_REPLICATION_SLOT_NAME,
      reactionPublicationName:
        options?.reactionPublicationName ??
        env.STATUS_REACTION_CDC_PUBLICATION_NAME,
      reactionSlotName:
        options?.reactionSlotName ??
        env.STATUS_REACTION_CDC_REPLICATION_SLOT_NAME,
      lagWarningBytes:
        options?.lagWarningBytes ??
        Number(env.STATUS_CDC_LAG_WARNING_BYTES ?? DEFAULT_LAG_WARNING_BYTES),
    }),
    getHistoryOutboxStatus({
      queryClient: options?.queryClient ?? db,
      timeoutMs,
    }),
  ]).finally(async () => {
    await externalReactionDb?.disconnect();
  });

  const correlatedHistoryOutbox = correlateHistoryOutboxWithQueue(
    historyOutbox,
    queue,
  );

  const services: StatusItem[] = [
    {
      id: "app",
      label: "前端 App",
      status: env.STATUS_APP_URL ? "available" : "unknown",
      url: env.STATUS_APP_URL,
      checkedAt: checkedAt(),
      reason: env.STATUS_APP_URL ? undefined : "STATUS_APP_URL 未設定",
    },
    {
      id: "server",
      label: "Rezics Server",
      status: "available",
      url: env.STATUS_SERVER_URL,
      checkedAt: checkedAt(),
    },
    authService,
    jobRunnerHealth,
    jobRunnerReady,
    {
      id: "meili",
      label: "Meilisearch",
      status: meili.status,
      url: env.STATUS_MEILI_URL ?? env.MEILI_HOST,
      checkedAt: meili.checkedAt,
      reason: meili.reason,
    },
    sequin,
  ];

  const links = [
    statusLink("app", "前端 App", env.STATUS_APP_URL),
    statusLink("server", "Rezics Server", env.STATUS_SERVER_URL),
    statusLink("auth", "Auth", env.AUTH_PUBLIC_BASE_URL),
    statusLink("job-runner", "Job-runner", jobRunnerBaseUrl),
    statusLink("meili", "Meilisearch", env.STATUS_MEILI_URL ?? env.MEILI_HOST),
    statusLink(
      "sequin",
      "Sequin",
      options?.sequinUiUrl ?? env.STATUS_SEQUIN_UI_URL,
    ),
  ];

  return {
    status: statusFromParts([
      ...services.map((service) => service.status),
      cdc.item.status,
      correlatedHistoryOutbox.item.status,
      queue.item.status,
    ]),
    checkedAt: checkedAt(),
    services,
    links,
    databases: [cdc.item],
    cdc,
    historyOutbox: correlatedHistoryOutbox,
    queue,
    meili,
    sequin: {
      ...sequin,
      remediation: env.STATUS_SEQUIN_WEBHOOK_TARGET_NAME
        ? `Webhook target: ${env.STATUS_SEQUIN_WEBHOOK_TARGET_NAME}`
        : sequin.remediation,
    },
  };
}
