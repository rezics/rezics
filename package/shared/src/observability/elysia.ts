import { Elysia } from "elysia";
import {
  createErrorLogEvent,
  createRequestTimingEvent,
  formatErrorLogEvent,
  formatRequestTimingEvent,
} from "./format";
import type { ObservabilityConfig } from "./types";

function requestPath(request: Request | undefined): string {
  if (!request) return "/";
  try {
    return new URL(request.url).pathname;
  } catch {
    return request.url;
  }
}

function requestId(request: Request | undefined): string | undefined {
  return (
    request?.headers.get("x-request-id") ??
    request?.headers.get("x-correlation-id") ??
    undefined
  );
}

function statusNumber(status: unknown, fallback = 200): number {
  if (typeof status === "number") return status;
  if (typeof status === "string") {
    const parsed = Number(status);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

export function elysiaObservability(config: ObservabilityConfig): Elysia {
  return new Elysia({ name: `observability:${config.service.key}` })
    .trace(async ({ onHandle, context, set }) => {
      onHandle(({ begin, onStop }) => {
        onStop(({ end }) => {
          const route = context.route === "unknown" ? undefined : context.route;
          const event = createRequestTimingEvent({
            config,
            method: context.request.method,
            route,
            path: requestPath(context.request),
            status: statusNumber(set.status),
            durationMs: end - begin,
            requestId: requestId(context.request),
          });

          console[event.level](formatRequestTimingEvent(event, config));
        });
      });
    })
    .onError(({ code, error, request, set }) => {
      const event = createErrorLogEvent({
        config,
        code: typeof code === "string" ? code : String(code),
        error,
        method: request.method,
        path: requestPath(request),
        status: statusNumber(set.status, 500),
        requestId: requestId(request),
      });

      console.error(formatErrorLogEvent(event, config));
    });
}
