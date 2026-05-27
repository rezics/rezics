import { prisma } from "#/prisma/client";
import { env } from "@/env";
import { getMeiliStatusSummary } from "@/meili/status.service";
import type {
  CdcStatus,
  FailedJobSummary,
  QueueStateCounts,
  QueueStatus,
  StatusItem,
  StatusLink,
  StatusState,
  SystemStatusSummary,
  WorkDomainDiagnostics,
} from "./status.types";

const DEFAULT_TIMEOUT_MS = 2_500;
const DEFAULT_LAG_WARNING_BYTES = 256 * 1024 * 1024;
const DEFAULT_WORK_DOMAIN_RELEASE_WARNING_COUNT = 24;

const ROUTED_SEQUIN_TABLES = [
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
] as const;

type FetchLike = typeof fetch;

interface QueryClient {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
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

async function getCdcStatus(options: {
  queryClient: QueryClient;
  timeoutMs: number;
  publicationName?: string;
  slotName?: string;
  lagWarningBytes?: number;
}): Promise<CdcStatus> {
  const publicationName = options.publicationName ?? defaultPublicationName();
  const slotName = options.slotName ?? defaultSlotName();
  const lagWarningBytes = options.lagWarningBytes ?? DEFAULT_LAG_WARNING_BYTES;
  const base = {
    routedTables: [...ROUTED_SEQUIN_TABLES],
    publicationTables: [],
    missingTables: [...ROUTED_SEQUIN_TABLES],
    publicationName,
    slotName,
  };

  try {
    const [walRows, publicationRows, slotRows] = await Promise.all([
      timeout(
        options.queryClient.$queryRawUnsafe<Array<{ wal_level: string }>>(
          "SHOW wal_level",
        ),
        options.timeoutMs,
      ),
      timeout(
        options.queryClient.$queryRawUnsafe<Array<{ tablename: string }>>(
          `SELECT c.relname AS tablename
           FROM pg_publication p
           JOIN pg_publication_rel pr ON pr.prpubid = p.oid
           JOIN pg_class c ON c.oid = pr.prrelid
           WHERE p.pubname = $1`,
          publicationName,
        ),
        options.timeoutMs,
      ),
      timeout(
        options.queryClient.$queryRawUnsafe<
          Array<{
            slot_name: string;
            active: boolean | null;
            confirmed_flush_lsn: string | null;
            lag_bytes: bigint | number | null;
          }>
        >(
          `SELECT slot_name, active, confirmed_flush_lsn,
                  pg_wal_lsn_diff(pg_current_wal_lsn(), confirmed_flush_lsn) AS lag_bytes
           FROM pg_replication_slots
           WHERE slot_name = $1`,
          slotName,
        ),
        options.timeoutMs,
      ),
    ]);

    const walLevel = walRows[0]?.wal_level ?? null;
    const publicationTables = publicationRows.map((row) => row.tablename);
    const missingTables = ROUTED_SEQUIN_TABLES.filter(
      (table) => !publicationTables.includes(table),
    );
    const slot = slotRows[0];
    const lagBytes =
      typeof slot?.lag_bytes === "bigint"
        ? Number(slot.lag_bytes)
        : (slot?.lag_bytes ?? null);
    const warnings = [
      walLevel !== "logical" ? "wal_level 不是 logical" : null,
      publicationRows.length === 0 ? "publication 不存在或沒有資料表" : null,
      missingTables.length > 0 ? "publication 缺少已路由資料表" : null,
      !slot ? "replication slot 不存在" : null,
      slot && slot.active === false ? "replication slot 未啟用" : null,
      typeof lagBytes === "number" && lagBytes > lagWarningBytes
        ? "replication slot lag 過高"
        : null,
    ].filter(Boolean);

    return {
      item: {
        id: "source-db-cdc",
        label: "來源資料庫 CDC",
        status: warnings.length > 0 ? "degraded" : "available",
        checkedAt: checkedAt(),
        reason: warnings.join("；") || undefined,
      },
      ...base,
      walLevel,
      publicationExists: publicationRows.length > 0,
      publicationTables,
      missingTables,
      slotExists: Boolean(slot),
      slotActive: slot?.active ?? null,
      confirmedFlushLsn: slot?.confirmed_flush_lsn ?? null,
      lagBytes,
    };
  } catch (error) {
    return {
      item: {
        id: "source-db-cdc",
        label: "來源資料庫 CDC",
        status: "unknown",
        checkedAt: checkedAt(),
        reason: safeFailureReason(error),
      },
      ...base,
    };
  }
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

async function getWorkDomainDiagnostics(options: {
  queryClient: QueryClient;
  timeoutMs: number;
  releaseCountThreshold: number;
}): Promise<WorkDomainDiagnostics> {
  try {
    const [hiddenWorks, projectionDrift, largeDomains] = await Promise.all([
      timeout(
        options.queryClient.$queryRawUnsafe<
          WorkDomainDiagnostics["hiddenWorks"]
        >(
          `SELECT
             w.id AS "workUnitId",
             w.status::text AS status,
             w.visibility::text AS visibility,
             COUNT(*) FILTER (WHERE uw.role = 'RELEASE')::int AS "releaseCount",
             COALESCE(
               json_agg(
                 json_build_object(
                   'unitId', uw."unitId",
                   'role', uw.role::text,
                   'position', uw.position,
                   'displayPolicy', uw."displayPolicy"::text,
                   'language', uw.language,
                   'status', u.status::text,
                   'type', u.type::text
                 )
                 ORDER BY uw.role, uw.position NULLS LAST, uw."unitId"
               ),
               '[]'::json
             ) AS members
           FROM "Unit" w
           JOIN "UnitWork" uw ON uw."workUnitId" = w.id
           JOIN "Unit" u ON u.id = uw."unitId"
           WHERE w.visibility <> 'PUBLIC'
           GROUP BY w.id, w.status, w.visibility
           ORDER BY "releaseCount" DESC, w.id
           LIMIT 20`,
        ),
        options.timeoutMs,
      ),
      timeout(
        options.queryClient.$queryRawUnsafe<
          WorkDomainDiagnostics["projectionDrift"]
        >(
          `SELECT
             uw."workUnitId",
             uw."unitId" AS "releaseUnitId",
             COUNT(wt."tagUnitId")::int AS "missingWorkTagCount",
             COALESCE(array_agg(wt."tagUnitId" ORDER BY wt."tagUnitId"), '{}') AS "missingWorkTagIds"
           FROM "UnitWork" uw
           JOIN "UnitTag" wt ON wt."unitId" = uw."workUnitId"
           LEFT JOIN "UnitTag" rt
             ON rt."unitId" = uw."unitId"
            AND rt."tagUnitId" = wt."tagUnitId"
           WHERE uw.role = 'RELEASE'
             AND rt."tagUnitId" IS NULL
           GROUP BY uw."workUnitId", uw."unitId"
           ORDER BY "missingWorkTagCount" DESC, uw."workUnitId", uw."unitId"
           LIMIT 50`,
        ),
        options.timeoutMs,
      ),
      timeout(
        options.queryClient.$queryRawUnsafe<
          Array<{ workUnitId: string; releaseCount: number }>
        >(
          `SELECT
             "workUnitId",
             COUNT(*)::int AS "releaseCount"
           FROM "UnitWork"
           WHERE role = 'RELEASE'
           GROUP BY "workUnitId"
           HAVING COUNT(*) > $1
           ORDER BY "releaseCount" DESC, "workUnitId"
           LIMIT 50`,
          options.releaseCountThreshold,
        ),
        options.timeoutMs,
      ),
    ]);

    const normalizedDrift = projectionDrift.map((row) => ({
      ...row,
      missingWorkTagIds: normalizeStringArray(row.missingWorkTagIds),
      missingWorkTagCount: Number(row.missingWorkTagCount ?? 0),
    }));
    const normalizedLargeDomains = largeDomains.map((row) => ({
      workUnitId: row.workUnitId,
      releaseCount: Number(row.releaseCount ?? 0),
      threshold: options.releaseCountThreshold,
    }));
    const status =
      normalizedDrift.length > 0 || normalizedLargeDomains.length > 0
        ? "degraded"
        : "available";

    return {
      item: {
        id: "work-domain-diagnostics",
        label: "Work-domain diagnostics",
        status,
        checkedAt: checkedAt(),
        reason:
          status === "degraded"
            ? "work-domain projection drift or large domains need review"
            : undefined,
      },
      releaseCountThreshold: options.releaseCountThreshold,
      hiddenWorks,
      projectionDrift: normalizedDrift,
      largeDomains: normalizedLargeDomains,
    };
  } catch (error) {
    return {
      item: {
        id: "work-domain-diagnostics",
        label: "Work-domain diagnostics",
        status: "unknown",
        checkedAt: checkedAt(),
        reason: safeFailureReason(error),
      },
      releaseCountThreshold: options.releaseCountThreshold,
      hiddenWorks: [],
      projectionDrift: [],
      largeDomains: [],
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
  lagWarningBytes?: number;
  workDomainReleaseCountThreshold?: number;
  meiliSummary?: Awaited<ReturnType<typeof getMeiliStatusSummary>>;
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

  const [
    meili,
    authService,
    jobRunnerHealth,
    jobRunnerReady,
    sequin,
    queue,
    cdc,
    workDomains,
  ] = await Promise.all([
    options?.meiliSummary
      ? Promise.resolve(options.meiliSummary)
      : getMeiliStatusSummary({ timeoutMs }),
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
      queryClient: options?.queryClient ?? prisma,
      timeoutMs,
      publicationName:
        options?.publicationName ?? env.STATUS_CDC_PUBLICATION_NAME,
      slotName: options?.slotName ?? env.STATUS_CDC_REPLICATION_SLOT_NAME,
      lagWarningBytes:
        options?.lagWarningBytes ??
        Number(env.STATUS_CDC_LAG_WARNING_BYTES ?? DEFAULT_LAG_WARNING_BYTES),
    }),
    getWorkDomainDiagnostics({
      queryClient: options?.queryClient ?? prisma,
      timeoutMs,
      releaseCountThreshold:
        options?.workDomainReleaseCountThreshold ??
        Number(
          env.STATUS_WORK_DOMAIN_RELEASE_WARNING_COUNT ??
            DEFAULT_WORK_DOMAIN_RELEASE_WARNING_COUNT,
        ),
    }),
  ]);

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
      queue.item.status,
      workDomains.item.status,
    ]),
    checkedAt: checkedAt(),
    services,
    links,
    databases: [cdc.item],
    cdc,
    queue,
    workDomains,
    meili,
    sequin: {
      ...sequin,
      remediation: env.STATUS_SEQUIN_WEBHOOK_TARGET_NAME
        ? `Webhook target: ${env.STATUS_SEQUIN_WEBHOOK_TARGET_NAME}`
        : sequin.remediation,
    },
  };
}
