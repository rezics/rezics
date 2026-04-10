import { cors } from "@elysiajs/cors";
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
  .get("/", () => "Notify service")
  .get("/health", () => ({ status: "ok" }));

app.listen(port);

console.log(
  `🔔 Notify service is running at http://${app.server?.hostname}:${app.server?.port}`,
);
