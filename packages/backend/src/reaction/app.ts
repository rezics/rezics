import { cors } from "@elysiajs/cors";
import { openapi } from "@elysiajs/openapi";
import {
  createObservabilityConfig,
  createTelemetryConfig,
  elysiaObservability,
  initializeOpenTelemetry,
} from "@/internal/shared/observability";
import { Elysia } from "elysia";
import { env } from "./env";
import { internalApi } from "./internal/internal.api";
import { reactionApi } from "./reaction/reaction.api";

const isDev = (env.NODE_ENV ?? "development") !== "production";

const devOrigins = [
  "http://localhost:35001",
  "http://localhost:35002",
  "http://localhost:8000",
];

const prodOrigins = ["https://book.rezics.com", "https://rezics.com"];

export type CreateReactionAppOptions = {
  initializeTelemetry?: boolean;
  openApiPath?: string | false;
  port?: number;
};

export async function createReactionApp(
  options: CreateReactionAppOptions = {},
) {
  const port = options.port ?? (env.PORT ? Number(env.PORT) : 3003);
  const observability = createObservabilityConfig(
    {
      key: "reaction",
      displayName: "Reaction Service",
      environment: env.NODE_ENV ?? "development",
      port,
      openApiPath:
        options.openApiPath === false
          ? undefined
          : (options.openApiPath ?? "/openapi"),
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

  const app = new Elysia()
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
          info: {
            title: "Reaction Service",
            version: "1.0.0",
          },
          tags: [
            { name: "Reactions", description: "Reaction operations" },
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
    .use(reactionApi)
    .use(internalApi)
    .get("/", () => "Reaction service", {
      detail: { summary: "Service info", tags: ["Health"] },
    })
    .get("/health", () => ({ status: "ok" }), {
      detail: { summary: "Health check", tags: ["Health"] },
    })
    .get("/ready", () => ({ status: "ready" }), {
      detail: { summary: "Readiness check", tags: ["Health"] },
    });

  return { app, observability, port };
}

export type ReactionApp = Awaited<ReturnType<typeof createReactionApp>>["app"];
