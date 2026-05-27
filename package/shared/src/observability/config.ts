import type {
  ObservabilityConfig,
  ObservabilityEnvInput,
  ObservabilityOutputMode,
  ObservabilityRuntimeConfig,
  ServiceMetadata,
  TelemetryConfig,
} from "./types";

const DEFAULT_SLOW_REQUEST_THRESHOLD_MS = 500;

export function normalizePath(path: string): string {
  if (!path) return "/";
  return path.startsWith("/") ? path : `/${path}`;
}

export function joinUrl(baseUrl: string, path: string): string {
  const normalizedPath = normalizePath(path);
  return `${baseUrl.replace(/\/+$/, "")}${normalizedPath}`;
}

export function resolveServiceUrl(service: ServiceMetadata): string {
  if (service.serviceUrl) return service.serviceUrl.replace(/\/+$/, "");

  const hostname = service.hostname ?? "localhost";
  return `http://${hostname}:${service.port}`;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  if (["1", "true", "yes", "on"].includes(value.toLowerCase())) return true;
  if (["0", "false", "no", "off"].includes(value.toLowerCase())) return false;
  return fallback;
}

function parsePositiveNumber(
  value: string | undefined,
  fallback: number,
): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function resolveOutputMode(
  env: ObservabilityEnvInput,
): ObservabilityOutputMode {
  if (env.logFormat === "json") return "json";
  if (env.logFormat === "local") return "local";
  return env.nodeEnv === "production" ? "json" : "local";
}

export function createObservabilityConfig(
  service: ServiceMetadata,
  env: ObservabilityEnvInput = {},
): ObservabilityConfig {
  const slowRequestThresholdMs = parsePositiveNumber(
    env.slowRequestThresholdMs,
    service.slowRequestThresholdMs ?? DEFAULT_SLOW_REQUEST_THRESHOLD_MS,
  );
  const outputMode = resolveOutputMode(env);
  const runtime: ObservabilityRuntimeConfig = {
    outputMode,
    color: outputMode === "local" && parseBoolean(env.color, true),
    slowRequestThresholdMs,
  };

  return {
    service: {
      ...service,
      environment: service.environment || env.nodeEnv || "development",
      slowRequestThresholdMs,
    },
    runtime,
  };
}

export function createTelemetryConfig(
  service: ServiceMetadata,
  env: ObservabilityEnvInput = {},
): TelemetryConfig {
  const mode = env.telemetryMode ?? "auto";
  const enabled =
    mode === "disabled"
      ? false
      : mode === "enabled" || mode === "required" || Boolean(env.otlpEndpoint);

  return {
    serviceName: service.key,
    environment: service.environment || env.nodeEnv || "development",
    enabled,
    required: mode === "required",
    otlpEndpoint: env.otlpEndpoint,
  };
}
