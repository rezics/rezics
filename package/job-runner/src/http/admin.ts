import { JOB_LANE_VALUES } from "@rezics/job";
import { Elysia } from "elysia";
import { isAuthorized } from "../auth";

const JOB_STATES = [
  "created",
  "retry",
  "active",
  "completed",
  "cancelled",
  "failed",
] as const;

type JobState = (typeof JOB_STATES)[number];

interface QueueStateCounts {
  created: number;
  retry: number;
  active: number;
  completed: number;
  cancelled: number;
  failed: number;
  all: number;
}

interface AdminDb {
  executeSql(text: string, values: unknown[]): Promise<{ rows: unknown[] }>;
}

type RawJob = Record<string, unknown>;

export interface AdminQueueLike {
  countStates?: () => Promise<{ queues?: Record<string, QueueStateCounts> }>;
  getDb?: () => AdminDb;
  getJobById?: (
    name: string,
    id: string,
    options?: { includeArchive?: boolean },
  ) => Promise<unknown>;
  getQueueSize?: (name: string, options?: unknown) => Promise<number>;
  fetch?: (name: string, options?: unknown) => Promise<unknown[]>;
  retry?: (name: string, id: string) => Promise<unknown>;
  cancel?: (name: string, id: string) => Promise<unknown>;
  deleteJob?: (name: string, id: string) => Promise<unknown>;
}

function zeroCounts(): QueueStateCounts {
  return {
    created: 0,
    retry: 0,
    active: 0,
    completed: 0,
    cancelled: 0,
    failed: 0,
    all: 0,
  };
}

function deadLane(lane: string) {
  return `${lane}.dead`;
}

function validLane(lane: string) {
  return JOB_LANE_VALUES.includes(lane as never);
}

function pgBossSchema(queue: AdminQueueLike) {
  const schema = (queue as { config?: { schema?: unknown } }).config?.schema;
  return typeof schema === "string" && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(schema)
    ? schema
    : "pgboss";
}

function readField<T>(job: RawJob, camel: string, snake: string): T | null {
  const value = job[camel] ?? job[snake];
  return value == null ? null : (value as T);
}

function normalizeJob(job: unknown) {
  if (!job || typeof job !== "object") return null;
  const raw = job as RawJob;
  const data = readField<RawJob>(raw, "data", "data") ?? {};
  const output = readField<RawJob>(raw, "output", "output") ?? {};
  const command = data && typeof data === "object" ? data : {};
  return {
    id: readField<string>(raw, "id", "id"),
    lane: readField<string>(raw, "name", "name"),
    state: readField<string>(raw, "state", "state"),
    commandKind: readField<string>(command, "kind", "kind"),
    commandLane: readField<string>(command, "lane", "lane"),
    idempotencyKey: readField<string>(
      command,
      "idempotencyKey",
      "idempotencyKey",
    ),
    tags: readField<string[]>(command, "tags", "tags") ?? [],
    source: readField<RawJob>(command, "source", "source") ?? null,
    attemptCount: readField<number>(raw, "retryCount", "retry_count") ?? 0,
    retryLimit: readField<number>(raw, "retryLimit", "retry_limit") ?? 0,
    lastError:
      readField<RawJob>(output, "value", "value") ??
      readField<RawJob>(output, "error", "error") ??
      null,
    meiliTasks: readField<unknown[]>(output, "meiliTasks", "meiliTasks") ?? [],
    createdAt: readField<Date | string>(raw, "createdOn", "created_on"),
    startedAt: readField<Date | string>(raw, "startedOn", "started_on"),
    completedAt: readField<Date | string>(raw, "completedOn", "completed_on"),
    keepUntil: readField<Date | string>(raw, "keepUntil", "keep_until"),
  };
}

async function countsFor(queue: AdminQueueLike) {
  if (queue.countStates) {
    const states = await queue.countStates();
    return JOB_LANE_VALUES.map((lane) => ({
      lane,
      ...(states.queues?.[lane] ?? zeroCounts()),
    }));
  }

  return Promise.all(
    JOB_LANE_VALUES.map(async (lane) => ({
      lane,
      ...zeroCounts(),
      created: queue.getQueueSize ? await queue.getQueueSize(lane) : 0,
    })),
  );
}

async function listFailedJobs(queue: AdminQueueLike, limit = 50) {
  const db = queue.getDb?.();
  if (!db) return [];
  const lanes = JOB_LANE_VALUES.flatMap((lane) => [lane, deadLane(lane)]);
  const schema = pgBossSchema(queue);
  const { rows } = await db.executeSql(
    `SELECT * FROM ${schema}.job
      WHERE name = ANY($1)
        AND (state = 'failed' OR name LIKE '%.dead')
      ORDER BY created_on DESC
      LIMIT $2`,
    [lanes, limit],
  );
  return rows.map(normalizeJob).filter(Boolean);
}

async function findJob(queue: AdminQueueLike, lane: string, id: string) {
  const job =
    (await queue.getJobById?.(lane, id, { includeArchive: true })) ??
    (await queue.getJobById?.(deadLane(lane), id, { includeArchive: true }));
  return normalizeJob(job);
}

async function resolveJobLane(queue: AdminQueueLike, lane: string, id: string) {
  if (await queue.getJobById?.(lane, id, { includeArchive: true })) return lane;
  if (await queue.getJobById?.(deadLane(lane), id, { includeArchive: true })) {
    return deadLane(lane);
  }
  return lane;
}

export function createAdminApi(options: {
  queue: AdminQueueLike;
  internalSecret: string;
}) {
  return new Elysia({ name: "job-runner-admin" })
    .derive(({ headers, set }) => {
      if (!isAuthorized(headers, options.internalSecret)) {
        set.status = 401;
        return { authorized: false };
      }
      return { authorized: true };
    })
    .get("/admin/queues/counts", async ({ authorized }) => {
      if (!authorized) return { status: "error", message: "Unauthorized" };
      return { counts: await countsFor(options.queue) };
    })
    .get("/admin/jobs/failed", async ({ authorized, query }) => {
      if (!authorized) return { status: "error", message: "Unauthorized" };
      const limit =
        typeof query.limit === "string" ? Number.parseInt(query.limit, 10) : 50;
      return {
        jobs: await listFailedJobs(
          options.queue,
          Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 100) : 50,
        ),
      };
    })
    .get(
      "/admin/jobs/failed/:lane/:id",
      async ({ authorized, params, set }) => {
        if (!authorized) return { status: "error", message: "Unauthorized" };
        if (!validLane(params.lane)) {
          set.status = 400;
          return { status: "error", message: "Unknown lane" };
        }
        const job = await findJob(options.queue, params.lane, params.id);
        if (!job) set.status = 404;
        return { lane: params.lane, id: params.id, job };
      },
    )
    .post(
      "/admin/jobs/failed/:lane/:id/retry",
      async ({ authorized, params, set }) => {
        if (!authorized) return { status: "error", message: "Unauthorized" };
        if (!validLane(params.lane)) {
          set.status = 400;
          return { status: "error", message: "Unknown lane" };
        }
        const resolvedLane = await resolveJobLane(
          options.queue,
          params.lane,
          params.id,
        );
        await options.queue.retry?.(resolvedLane, params.id);
        return { status: "ok", lane: resolvedLane, id: params.id };
      },
    )
    .post(
      "/admin/jobs/failed/:lane/:id/discard",
      async ({ authorized, params, set }) => {
        if (!authorized) return { status: "error", message: "Unauthorized" };
        if (!validLane(params.lane)) {
          set.status = 400;
          return { status: "error", message: "Unknown lane" };
        }
        const resolvedLane = await resolveJobLane(
          options.queue,
          params.lane,
          params.id,
        );
        if (options.queue.deleteJob) {
          await options.queue.deleteJob(resolvedLane, params.id);
        } else {
          await options.queue.cancel?.(resolvedLane, params.id);
        }
        return { status: "ok", lane: resolvedLane, id: params.id };
      },
    );
}
