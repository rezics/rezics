import { cors } from "@elysiajs/cors";
import { openapi } from "@elysiajs/openapi";
import { Elysia } from "elysia";
import { createAdminApi } from "./http/admin";
import { createEnqueueApi } from "./http/enqueue";
import { createSequinApi } from "./http/sequin";
import type { QueueLike } from "./queue/types";

export function createJobRunnerApp(options: {
  queue: QueueLike;
  internalSecret: string;
  sequinWebhookSecret: string;
  readiness?: () => Promise<boolean> | boolean;
}) {
  return new Elysia()
    .use(
      cors({
        origin: false,
        methods: ["GET", "POST", "OPTIONS"],
        allowedHeaders: ["content-type", "authorization", "x-internal-secret"],
        maxAge: 600,
      }),
    )
    .use(
      openapi({
        documentation: {
          info: { title: "Job Runner Service", version: "1.0.0" },
          tags: [
            { name: "Health", description: "Health and readiness checks" },
            { name: "Jobs", description: "Internal job enqueue endpoints" },
            { name: "CDC", description: "Sequin webhook endpoints" },
            { name: "Admin", description: "Internal queue operations" },
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
    .get("/", () => "Job runner service")
    .get("/health", () => ({ status: "ok" }))
    .get("/ready", async ({ set }) => {
      const ready = options.readiness ? await options.readiness() : true;
      if (!ready) set.status = 503;
      return { status: ready ? "ready" : "not_ready" };
    })
    .use(
      createEnqueueApi({
        queue: options.queue,
        internalSecret: options.internalSecret,
      }),
    )
    .use(
      createSequinApi({
        queue: options.queue,
        webhookSecret: options.sequinWebhookSecret,
      }),
    )
    .use(
      createAdminApi({
        queue: options.queue as never,
        internalSecret: options.internalSecret,
      }),
    );
}
