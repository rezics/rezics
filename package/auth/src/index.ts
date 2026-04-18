import { cors } from "@elysiajs/cors";
import { openapi } from "@elysiajs/openapi";
import { adminEmailApi } from "./admin/email.api";
import { coreInstance } from "./core";
import { env } from "./env";
import { authInternalApi } from "./internal/internal.api";
import { authOpenApiRouter } from "./openapi";
import { wellKnownApi } from "./well-known/well-known.api";

const isDev = env.NODE_ENV === "development";

const app = coreInstance();

if (isDev) {
  await import("./utils/logger-hook");
  app
    .use(openapi({ exclude: { staticFile: false } }))
    .trace(async ({ onHandle, context }) => {
      // 监听 handle 阶段
      onHandle(({ begin, onStop }) => {
        const { route, params, request } = context;

        onStop(({ end }) => {
          console.log(
            `[${request.method}] ${route} took ${end - begin}ms`,
            "params:",
            params,
          );
        });
      });
    })
    .onError(({ code, error, set }) => {
      console.log("[Error] ", code, error, set);
    });
}

const devOrigins = [
  "http://localhost:35001",
  "http://localhost:35002",
  "http://localhost:8000",
];

const prodOrigins = ["https://book.rezics.com", "https://rezics.com"];

app
  .use(
    cors({
      origin: isDev ? devOrigins : prodOrigins,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: [
        "content-type",
        "authorization",
        "x-internal-auth-token",
        "x-internal-secret",
        "x-auth-session-token",
      ],
      maxAge: 600,
    }),
  )
  .onError(({ error, set }) => {
    if (!set.status) {
      set.status = 500;
    }

    return {
      error: error instanceof Error ? error.message : "Internal Server Error",
    };
  })
  .use(wellKnownApi)
  .use(authInternalApi)
  .use(adminEmailApi)
  .use(authOpenApiRouter)
  .get("/health", () => ({ status: "ok" }));

console.log("env.PORT", env.PORT);
const port = Number(env.PORT);
app.listen(port);

console.log(
  `🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`,
  `\n🔗 Openapi UI: http://${app.server?.hostname}:${app.server?.port}/openapi`,
);
