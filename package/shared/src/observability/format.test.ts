import { describe, expect, test } from "bun:test";
import {
  createObservabilityConfig,
  createTelemetryConfig,
  createRequestTimingEvent,
  formatRequestTimingEvent,
  initializeOpenTelemetry,
  redactSensitiveFields,
  renderStartupBanner,
} from "./index";

const baseConfig = createObservabilityConfig(
  {
    key: "server",
    displayName: "Main Server",
    environment: "development",
    port: 3000,
    openApiPath: "/openapi",
    healthPath: "/health",
    readyPath: "/ready",
    slowRequestThresholdMs: 100,
  },
  { nodeEnv: "development", color: "false" },
);

describe("observability formatting", () => {
  test("renders startup banner URLs", () => {
    expect(renderStartupBanner(baseConfig)).toContain("Main Server started");
    expect(renderStartupBanner(baseConfig)).toContain(
      "OpenAPI: http://localhost:3000/openapi",
    );
    expect(renderStartupBanner(baseConfig)).toContain(
      "Health: http://localhost:3000/health",
    );
    expect(renderStartupBanner(baseConfig)).toContain(
      "Readiness: http://localhost:3000/ready",
    );
  });

  test("formats local request timing and classifies slow requests", () => {
    const event = createRequestTimingEvent({
      config: baseConfig,
      method: "GET",
      route: "/books/:id",
      path: "/books/1",
      status: 200,
      durationMs: 120.1234,
    });

    expect(event.slow).toBe(true);
    expect(formatRequestTimingEvent(event, baseConfig)).toBe(
      "[GET] /books/:id 200 120.1ms slow",
    );
  });

  test("formats production request timing as newline-safe JSON", () => {
    const config = createObservabilityConfig(
      {
        key: "auth",
        displayName: "Auth Service",
        environment: "production",
        port: 3001,
      },
      { nodeEnv: "production" },
    );
    const event = createRequestTimingEvent({
      config,
      method: "POST",
      path: "/login",
      status: 201,
      durationMs: 12,
      requestId: "req-1",
    });

    const formatted = formatRequestTimingEvent(event, config);
    expect(formatted).not.toContain("\x1b[");
    expect(formatted).not.toContain("\n");
    expect(JSON.parse(formatted)).toMatchObject({
      service: "Auth Service",
      environment: "production",
      method: "POST",
      path: "/login",
      status: 201,
      durationMs: 12,
      requestId: "req-1",
    });
  });

  test("preserves trace correlation fields in structured request logs", () => {
    const config = createObservabilityConfig(
      {
        key: "history",
        displayName: "History Service",
        environment: "production",
        port: 3004,
      },
      { nodeEnv: "production" },
    );
    const formatted = formatRequestTimingEvent(
      {
        timestamp: "2026-05-27T00:00:00.000Z",
        level: "info",
        service: "History Service",
        serviceKey: "history",
        environment: "production",
        message: "GET /ready 200 1.0ms",
        method: "GET",
        route: "/ready",
        path: "/ready",
        status: 200,
        durationMs: 1,
        slow: false,
        traceId: "0af7651916cd43dd8448eb211c80319c",
        spanId: "b7ad6b7169203331",
      },
      config,
    );

    expect(JSON.parse(formatted)).toMatchObject({
      traceId: "0af7651916cd43dd8448eb211c80319c",
      spanId: "b7ad6b7169203331",
    });
  });

  test("keeps telemetry disabled when no endpoint is configured", async () => {
    const telemetry = createTelemetryConfig(baseConfig.service, {
      telemetryMode: "auto",
    });

    expect(telemetry.enabled).toBe(false);
    await expect(initializeOpenTelemetry(telemetry)).resolves.toEqual({
      enabled: false,
    });
  });

  test("creates configured telemetry settings without backend-specific fields", () => {
    expect(
      createTelemetryConfig(baseConfig.service, {
        telemetryMode: "enabled",
        otlpEndpoint: "http://localhost:4318/v1/traces",
      }),
    ).toMatchObject({
      enabled: true,
      required: false,
      otlpEndpoint: "http://localhost:4318/v1/traces",
      serviceName: "server",
    });
  });

  test("redacts sensitive fields recursively", () => {
    expect(
      redactSensitiveFields({
        authorization: "Bearer secret",
        nested: {
          cookie: "sid=secret",
          safe: "visible",
          internal_token: "secret",
        },
      }),
    ).toEqual({
      authorization: "[REDACTED]",
      nested: {
        cookie: "[REDACTED]",
        safe: "visible",
        internal_token: "[REDACTED]",
      },
    });
  });
});
