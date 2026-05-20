import { cors } from "@elysiajs/cors";
import { openapi } from "@elysiajs/openapi";
import { Elysia } from "elysia";
import { env } from "./env";
import { createDefaultHistoryOutboxConsumer } from "./outbox";
import { revisionApi } from "./revision/revision.api";

import "dotenv/config";

const isDev = (env.NODE_ENV ?? "development") !== "production";
const port = env.PORT ? Number(env.PORT) : 3004;
const outboxIntervalMs = Number(process.env.HISTORY_OUTBOX_POLL_MS ?? 2000);

const devOrigins = [
  "http://localhost:35001",
  "http://localhost:35002",
  "http://localhost:8000",
];

const prodOrigins = ["https://book.rezics.com", "https://rezics.com"];

export const app = new Elysia()
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

if (process.env.HISTORY_OUTBOX_CONSUMER !== "0") {
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
}

const stopOutbox = () => {
  if (outboxTimer) clearInterval(outboxTimer);
};

process.on("SIGTERM", stopOutbox);
process.on("SIGINT", stopOutbox);

console.log(
  `History service is running at http://${app.server?.hostname}:${app.server?.port}`,
  `\nOpenAPI documentation: http://${app.server?.hostname}:${app.server?.port}/openapi`,
);
