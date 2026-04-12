import { cors } from "@elysiajs/cors";
import { openapi } from "@elysiajs/openapi";
import { Elysia } from "elysia";
import { dmApi } from "./dm/dm.api";
import { env } from "./env";
import { internalApi } from "./internal/internal.api";
import { notificationApi } from "./notification/notification.api";
import { streamApi } from "./stream/stream.api";

import "dotenv/config";

const isDev = (env.NODE_ENV ?? "development") !== "production";

const devOrigins = [
  "http://localhost:35001",
  "http://localhost:35002",
  "http://localhost:8000",
];

const prodOrigins = ["https://book.rezics.com", "https://rezics.com"];

const port = env.PORT ? Number(env.PORT) : 3002;

const app = new Elysia()
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
        info: {
          title: "Notify Service",
          version: "1.0.0",
        },
        tags: [
          { name: "Notifications", description: "Notification operations" },
          { name: "Direct Messages", description: "Direct messaging" },
          { name: "Realtime", description: "SSE and WebSocket endpoints" },
          { name: "Internal", description: "Service-to-service endpoints" },
          { name: "Health", description: "Health check endpoints" },
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: "http",
              scheme: "bearer",
              bearerFormat: "JWT",
            },
            internalSecret: {
              type: "apiKey",
              in: "header",
              name: "x-internal-secret",
            },
          },
        },
      },
    }),
  )
  .onError(({ error, set }) => {
    set.status ||= 500;
    const message =
      error instanceof Error ? error.message : "Internal Server Error";
    return { status: set.status, message };
  })
  .use(notificationApi)
  .use(streamApi)
  .use(dmApi)
  .use(internalApi)
  .get("/", () => "Notify service", {
    detail: { summary: "Service info", tags: ["Health"] },
  })
  .get("/health", () => ({ status: "ok" }), {
    detail: { summary: "Health check", tags: ["Health"] },
  });

app.listen(port);

console.log(
  `🔔 Notify service is running at http://${app.server?.hostname}:${app.server?.port}`,
  `\n🔗 OpenAPI documentation: http://${app.server?.hostname}:${app.server?.port}/openapi`,
);
