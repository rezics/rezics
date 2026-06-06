import { openapi } from "@elysiajs/openapi";
import { html } from "@elysiajs/html";
import {
  createObservabilityConfig,
  createTelemetryConfig,
  elysiaObservability,
  initializeOpenTelemetry,
  logStartupBanner,
} from "@rezics/shared/observability";
import { Elysia } from "elysia";
import { bookApi } from "./book/book.api";
import { env } from "./env";
import { sitemapApi } from "./sitemap/sitemap.api";
import { getProdState } from "./utils/getProdState";

const { isDev } = getProdState();
const port = Number(env.SERVER_PORT);
const observability = createObservabilityConfig(
  {
    key: "preview",
    displayName: "Preview Service",
    environment: env.NODE_ENV ?? "development",
    port,
    openApiPath: isDev ? "/openapi" : undefined,
    healthPath: "/health",
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

const app = new Elysia()
  .use(elysiaObservability(observability))
  .use(html())
  .use(sitemapApi)
  .use(bookApi)
  .get("/health", () => ({ status: "ok" }));

if (isDev) {
  app.use(openapi({ exclude: { staticFile: false } }));
}

app.listen(port);
logStartupBanner(observability);
