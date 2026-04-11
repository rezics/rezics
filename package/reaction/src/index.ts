import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";
import { env } from "./env";
import { internalApi } from "./internal/internal.api";
import { reactionApi } from "./reaction/reaction.api";

import "dotenv/config";

const isDev = (env.NODE_ENV ?? "development") !== "production";

const devOrigins = [
  "http://localhost:35001",
  "http://localhost:35002",
  "http://localhost:8000",
];

const prodOrigins = ["https://book.rezics.com", "https://rezics.com"];

const port = env.PORT ? Number(env.PORT) : 3003;

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
  .use(reactionApi)
  .use(internalApi)
  .get("/", () => "Reaction service")
  .get("/health", () => ({ status: "ok" }));

app.listen(port);

console.log(
  `⚡ Reaction service is running at http://${app.server?.hostname}:${app.server?.port}`,
);
