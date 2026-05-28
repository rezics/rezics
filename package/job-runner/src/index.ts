import "dotenv/config";

import {
  createObservabilityConfig,
  createTelemetryConfig,
  initializeOpenTelemetry,
  logStartupBanner,
} from "@rezics/shared/observability";
import { createJobRunnerApp } from "./app";
import { env } from "./env";
import { createJobHandlers } from "./handlers";
import { resolveWorkerLanes } from "./lanes";
import {
  createAdminWorkMergeRuntime,
  type AdminWorkMergeRuntime,
} from "./handlers/admin-work-merge/runtime";
import {
  createHistoryRuntime,
  type HistoryRuntime,
} from "./handlers/history/runtime";
import {
  createRankingRuntime,
  type RankingRuntime,
} from "./handlers/ranking/runtime";
import {
  createSearchRuntime,
  type SearchRuntime,
} from "./handlers/search/runtime";
import { createBoss } from "./queue/boss";
import { assertSequinHealthAvailable } from "./sequin/preflight";
import { registerWorkers } from "./worker";

const port = env.PORT ? Number(env.PORT) : 3005;
const role = env.JOB_RUNNER_ROLE;
const workerLanes = resolveWorkerLanes(env.JOB_WORKER_LANES);
const observability = createObservabilityConfig(
  {
    key: "job-runner",
    displayName: "Job Runner Service",
    environment: env.NODE_ENV ?? "development",
    port,
    openApiPath: "/openapi",
    healthPath: "/health",
    readyPath: "/ready",
  },
  {
    nodeEnv: env.NODE_ENV,
    logFormat: env.OBSERVABILITY_LOG_FORMAT,
    color: env.OBSERVABILITY_COLOR,
    slowRequestThresholdMs: env.OBSERVABILITY_SLOW_REQUEST_MS,
    telemetryMode: env.OBSERVABILITY_TELEMETRY,
    otlpEndpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT,
  },
);

let boss: Awaited<ReturnType<typeof createBoss>> | undefined;
let app: ReturnType<typeof createJobRunnerApp> | undefined;
let searchRuntime: SearchRuntime | undefined;
let historyRuntime: HistoryRuntime | undefined;
let adminWorkMergeRuntime: AdminWorkMergeRuntime | undefined;
let rankingRuntime: RankingRuntime | undefined;

if (role === "all" || role === "worker" || role === "http") {
  boss = await createBoss();
}

await assertSequinHealthAvailable({
  role,
  healthUrl: env.SEQUIN_HEALTH_URL,
});

if ((role === "all" || role === "worker") && boss) {
  searchRuntime = createSearchRuntime({
    serverDatabaseUrl: env.SERVER_DATABASE_URL,
    meiliHost: env.MEILI_HOST,
    meiliMasterKey: env.MEILI_MASTER_KEY,
  });
  historyRuntime = createHistoryRuntime({
    serverDatabaseUrl: env.SERVER_DATABASE_URL,
    historyDatabaseUrl: env.HISTORY_DATABASE_URL,
  });
  adminWorkMergeRuntime = createAdminWorkMergeRuntime({
    serverDatabaseUrl: env.SERVER_DATABASE_URL,
  });
  rankingRuntime = createRankingRuntime({
    rankingBaseUrl: env.RANKING_BASE_URL,
    rankingInternalSecret: env.RANKING_INTERNAL_SECRET,
  });
  await registerWorkers(
    boss as never,
    createJobHandlers({
      searchClient: searchRuntime.client,
      historyConsumer: historyRuntime.consumer,
      adminWorkMergeRuntime,
      rankingDispatcher: rankingRuntime,
    }),
    workerLanes,
  );
}

if ((role === "all" || role === "http") && boss) {
  await initializeOpenTelemetry(
    createTelemetryConfig(observability.service, {
      nodeEnv: env.NODE_ENV,
      telemetryMode: env.OBSERVABILITY_TELEMETRY,
      otlpEndpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT,
    }),
  );

  app = createJobRunnerApp({
    queue: boss as never,
    internalSecret: env.JOB_RUNNER_INTERNAL_SECRET,
    sequinWebhookSecret: env.SEQUIN_WEBHOOK_SECRET,
    readiness: () => Boolean(boss),
    observability,
  });
  app.listen(port);
  logStartupBanner(observability);
}

async function shutdown() {
  await searchRuntime?.disconnect();
  await historyRuntime?.disconnect();
  await adminWorkMergeRuntime?.disconnect();
  await rankingRuntime?.disconnect();
  await boss?.stop({ graceful: true, timeout: 30_000 });
  app?.server?.stop();
}

process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());
