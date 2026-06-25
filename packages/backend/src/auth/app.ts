import { cors } from "@elysiajs/cors";
import { openapi } from "@elysiajs/openapi";
import {
  createObservabilityConfig,
  createTelemetryConfig,
  elysiaObservability,
  initializeOpenTelemetry,
} from "@/internal/shared/observability";
import { adminEmailApi } from "./admin/email.api";
import { coreInstance } from "./core";
import { env } from "./env";
import { authInternalApi } from "./internal/internal.api";
import { authOpenApiRouter } from "./openapi";
import { wellKnownApi } from "./well-known/well-known.api";

export type CreateAuthAppOptions = {
  initializeTelemetry?: boolean;
  openApiPath?: string | false;
  port?: number;
};

export async function createAuthApp(options: CreateAuthAppOptions = {}) {
  const isDev = env.NODE_ENV === "development";
  const app = coreInstance();
  const port = options.port ?? Number(env.PORT);
  const openApiPath =
    options.openApiPath === false
      ? undefined
      : (options.openApiPath ?? (isDev ? "/openapi" : undefined));
  const observability = createObservabilityConfig(
    {
      key: "auth",
      displayName: "Auth Service",
      environment: env.NODE_ENV ?? "development",
      port,
      openApiPath,
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

  if (options.initializeTelemetry ?? true) {
    await initializeOpenTelemetry(
      createTelemetryConfig(observability.service, {
        nodeEnv: env.NODE_ENV,
        telemetryMode: env.OBSERVABILITY_TELEMETRY,
        otlpEndpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT,
      }),
    );
  }

  app.use(elysiaObservability(observability));

  if (isDev) {
    app.use(openapi({ exclude: { staticFile: false } }));
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
    .get("/health", () => ({ status: "ok" }))
    .get("/ready", () => ({ status: "ready" }));

  return { app, observability, port };
}

export type AuthApp = Awaited<ReturnType<typeof createAuthApp>>["app"];
