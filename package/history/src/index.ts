import { cors } from "@elysiajs/cors";
import { openapi } from "@elysiajs/openapi";
import {
  createObservabilityConfig,
  createTelemetryConfig,
  elysiaObservability,
  initializeOpenTelemetry,
  logStartupBanner,
} from "@rezics/shared/observability";
import { Elysia } from "elysia";
import { env } from "./env";
import { createDefaultHistoryOutboxConsumer } from "./outbox";
import { shouldStartHistoryOutboxPoller } from "./outbox/startup";
import { revisionApi } from "./revision/revision.api";

import "dotenv/config";

const isDev = (env.NODE_ENV ?? "development") !== "production";
const port = env.PORT ? Number(env.PORT) : 3004;
const outboxIntervalMs = Number(env.HISTORY_OUTBOX_POLL_MS ?? 2000);
const observability = createObservabilityConfig(
  {
    key: "history",
    displayName: "History Service",
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

await initializeOpenTelemetry(
  createTelemetryConfig(observability.service, {
    nodeEnv: env.NODE_ENV,
    telemetryMode: env.OBSERVABILITY_TELEMETRY,
    otlpEndpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT,
  }),
);

const devOrigins = [
  "http://localhost:35001",
  "http://localhost:35002",
  "http://localhost:8000",
];

const prodOrigins = ["https://book.rezics.com", "https://rezics.com"];

export const app = new Elysia()
  .use(elysiaObservability(observability))
  .use(
    cors({
      origin: isDev ? devOrigins : prodOrigins,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["content-type", "authorization", "x-internal-secret"],
      maxAge: 600,
    }),
  )
  .use(
    openapi({
      documentation: {
        info: { title: "History Service", version: "1.0.0" },
        tags: [
          { name: "History", description: "Unit revision history reads" },
          { name: "Health", description: "Health and readiness checks" },
        ],
      },
    }),
  )
  .onError(({ error, set }) => {
    set.status ||= 500;
    const message =
      error instanceof Error ? error.message : "Internal Server Error";
    return { status: set.status, message };
  })
  .use(revisionApi)
  .get("/", () => "History service", {
    detail: { summary: "Service info", tags: ["Health"] },
  })
  .get("/health", () => ({ status: "ok" }), {
    detail: { summary: "Health check", tags: ["Health"] },
  })
  .get("/ready", () => ({ status: "ready" }), {
    detail: { summary: "Readiness check", tags: ["Health"] },
  });

app.listen(port);

let outboxTimer: ReturnType<typeof setInterval> | undefined;
let outboxRunning = false;

if (shouldStartHistoryOutboxPoller(env)) {
  const consumer = await createDefaultHistoryOutboxConsumer();
  const consumeOnce = async () => {
    if (outboxRunning) return;
    outboxRunning = true;
    try {
      const result = await consumer.consumeBatch({ batchSize: 25 });
      if (result.processed > 0 || result.failed > 0) {
        console.log(
          `[History Outbox] processed=${result.processed} failed=${result.failed}`,
        );
      }
    } catch (error) {
      console.error("[History Outbox] consumer failed", error);
    } finally {
      outboxRunning = false;
    }
  };
  void consumeOnce();
  outboxTimer = setInterval(() => void consumeOnce(), outboxIntervalMs);
} else {
  console.log(
    "[History Outbox] poller disabled; queued job-runner ingestion is the default owner",
  );
}

const stopOutbox = () => {
  if (outboxTimer) clearInterval(outboxTimer);
};

process.on("SIGTERM", stopOutbox);
process.on("SIGINT", stopOutbox);

logStartupBanner(observability);
