import {
  createObservabilityConfig,
  createTelemetryConfig,
  initializeOpenTelemetry,
  logStartupBanner,
} from "@rezics/shared/observability";
import { createPreviewApp } from "./app";
import { bookApi } from "./book/book.api";
import { env } from "./env";
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

const app = createPreviewApp({ isDev, bookRoutes: bookApi, observability });
app.listen(port);
logStartupBanner(observability);
