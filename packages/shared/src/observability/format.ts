import { context, trace } from "@opentelemetry/api";
import { joinUrl, resolveServiceUrl } from "./config";
import { redactSensitiveFields } from "./redact";
import type {
  ErrorLogEvent,
  ObservabilityConfig,
  ObservabilityLevel,
  RequestTimingEvent,
} from "./types";

const ANSI = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
};

function color(enabled: boolean, value: string, code: string): string {
  return enabled ? `${code}${value}${ANSI.reset}` : value;
}

function levelForStatus(status: number, slow: boolean): ObservabilityLevel {
  if (status >= 500) return "error";
  if (status >= 400 || slow) return "warn";
  return "info";
}

function activeTraceFields(): { traceId?: string; spanId?: string } {
  const span = trace.getSpan(context.active());
  const spanContext = span?.spanContext();
  if (!spanContext) return {};
  return {
    traceId: spanContext.traceId,
    spanId: spanContext.spanId,
  };
}

export function renderStartupBanner(config: ObservabilityConfig): string {
  const { service, runtime } = config;
  const serviceUrl = resolveServiceUrl(service);
  const lines = [`${service.displayName} started`, `Service: ${serviceUrl}`];

  if (service.openApiPath) {
    lines.push(`OpenAPI: ${joinUrl(serviceUrl, service.openApiPath)}`);
  }

  if (service.healthPath) {
    lines.push(`Health: ${joinUrl(serviceUrl, service.healthPath)}`);
  }

  if (service.readyPath) {
    lines.push(`Readiness: ${joinUrl(serviceUrl, service.readyPath)}`);
  }

  if (runtime.outputMode === "json") {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "info",
      service: service.displayName,
      serviceKey: service.key,
      environment: service.environment,
      message: `${service.displayName} started`,
      urls: {
        service: serviceUrl,
        ...(service.openApiPath && {
          openApi: joinUrl(serviceUrl, service.openApiPath),
        }),
        ...(service.healthPath && {
          health: joinUrl(serviceUrl, service.healthPath),
        }),
        ...(service.readyPath && {
          readiness: joinUrl(serviceUrl, service.readyPath),
        }),
      },
    });
  }

  return lines
    .map((line, index) =>
      index === 0 ? color(runtime.color, line, ANSI.green) : `  ${line}`,
    )
    .join("\n");
}

export function createRequestTimingEvent(input: {
  config: ObservabilityConfig;
  method: string;
  route?: string;
  path: string;
  status: number;
  durationMs: number;
  requestId?: string;
}): RequestTimingEvent {
  const slow = input.durationMs >= input.config.runtime.slowRequestThresholdMs;
  const traceFields = activeTraceFields();

  return {
    timestamp: new Date().toISOString(),
    level: levelForStatus(input.status, slow),
    service: input.config.service.displayName,
    serviceKey: input.config.service.key,
    environment: input.config.service.environment,
    message: `${input.method} ${input.route ?? input.path} ${input.status} ${input.durationMs.toFixed(1)}ms`,
    method: input.method,
    route: input.route,
    path: input.path,
    status: input.status,
    durationMs: Number(input.durationMs.toFixed(3)),
    slow,
    requestId: input.requestId,
    ...traceFields,
  };
}

export function createErrorLogEvent(input: {
  config: ObservabilityConfig;
  error: unknown;
  code?: string;
  method?: string;
  route?: string;
  path?: string;
  status?: number;
  requestId?: string;
}): ErrorLogEvent {
  const error =
    input.error instanceof Error
      ? input.error
      : new Error(String(input.error ?? "Unknown error"));
  const traceFields = activeTraceFields();

  return {
    timestamp: new Date().toISOString(),
    level: "error",
    service: input.config.service.displayName,
    serviceKey: input.config.service.key,
    environment: input.config.service.environment,
    message: error.message,
    method: input.method,
    route: input.route,
    path: input.path,
    status: input.status,
    requestId: input.requestId,
    ...traceFields,
    error: {
      name: error.name,
      message: error.message,
      code: input.code,
    },
  };
}

export function formatRequestTimingEvent(
  event: RequestTimingEvent,
  config: ObservabilityConfig,
): string {
  if (config.runtime.outputMode === "json") {
    return JSON.stringify(redactSensitiveFields(event));
  }

  const method = color(config.runtime.color, `[${event.method}]`, ANSI.cyan);
  const target = color(
    config.runtime.color,
    event.route ?? event.path,
    ANSI.magenta,
  );
  const statusColor =
    event.status >= 500
      ? ANSI.red
      : event.status >= 400
        ? ANSI.yellow
        : ANSI.green;
  const status = color(config.runtime.color, String(event.status), statusColor);
  const durationColor = event.slow ? ANSI.red : ANSI.green;
  const duration = color(
    config.runtime.color,
    `${event.durationMs.toFixed(1)}ms`,
    durationColor,
  );
  const slow = event.slow
    ? ` ${color(config.runtime.color, "slow", ANSI.yellow)}`
    : "";

  return `${method} ${target} ${status} ${duration}${slow}`;
}

export function formatErrorLogEvent(
  event: ErrorLogEvent,
  config: ObservabilityConfig,
): string {
  if (config.runtime.outputMode === "json") {
    return JSON.stringify(redactSensitiveFields(event));
  }

  const prefix = color(config.runtime.color, "[Error]", ANSI.red);
  const target = event.route ?? event.path ?? "request";
  return `${prefix} ${target} ${event.error.name}: ${event.error.message}`;
}

export function logStartupBanner(config: ObservabilityConfig): void {
  console.info(renderStartupBanner(config));
}
