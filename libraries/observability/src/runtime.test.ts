import { createServer, type Server } from "node:http";
import { once } from "node:events";

import { SpanKind, trace } from "@opentelemetry/api";
import {
	AggregationTemporality,
	InMemoryMetricExporter,
	PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";
import { InMemorySpanExporter } from "@opentelemetry/sdk-trace-base";
import Elysia from "elysia";
import { afterEach, describe, expect, it } from "vitest";

import { createElysiaObservability } from "./elysia";
import { initializeObservability, type ObservabilityHandle } from "./runtime";
import { withDependencySpan } from "./operations";

let active: ObservabilityHandle | undefined;

afterEach(async () => {
	await active?.shutdown();
	active = undefined;
});

function inMemoryRuntime(lines: string[]) {
	const spans = new InMemorySpanExporter();
	const metricExporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);
	const metricReader = new PeriodicExportingMetricReader({
		exporter: metricExporter,
		exportIntervalMillis: 60_000,
		exportTimeoutMillis: 1_000,
		cardinalityLimits: { default: 32 },
	});
	active = initializeObservability({
		service: { name: "runtime-test", version: "1.0.0", environment: "test" },
		environmentVariables: { OTEL_TRACES_SAMPLER: "always_on" },
		overrides: {
			spanExporter: spans,
			metricReader,
			logWriter: (line) => lines.push(line),
		},
	});
	return { spans, metricExporter };
}

async function listen(server: Server): Promise<number> {
	server.listen(0, "127.0.0.1");
	await once(server, "listening");
	const address = server.address();
	if (!address || typeof address === "string") throw new Error("Expected a TCP server address");
	return address.port;
}

describe("observability runtime", () => {
	it("correlates JSON logs, preserves W3C parents, and exports only route templates", async () => {
		const lines: string[] = [];
		const { spans, metricExporter } = inMemoryRuntime(lines);
		const app = new Elysia()
			.use(createElysiaObservability())
			.get("/users/:userId", async ({ params }) => {
				active?.logger.info("Request handled", {
					eventName: "request.handled",
					attributes: { userId: params.userId },
				});
				await withDependencySpan({ dependency: "s3", operation: "get" }, async () => "ok");
				return "ok";
			});
		const incomingTraceId = "0af7651916cd43dd8448eb211c80319c";
		const response = await app.handle(
			new Request("http://localhost/users/private-user-123?token=fixture-secret", {
				headers: {
					traceparent: `00-${incomingTraceId}-b7ad6b7169203331-01`,
				},
			}),
		);
		await new Promise<void>((resolve) => setImmediate(resolve));
		await active?.flush();

		expect(response.status).toBe(200);
		const requestSpan = spans.getFinishedSpans().find((span) => span.kind === SpanKind.SERVER);
		const storageSpan = spans
			.getFinishedSpans()
			.find((span) => span.attributes["dependency.name"] === "s3");
		expect(requestSpan?.name).toBe("GET /users/:param");
		expect(requestSpan?.spanContext().traceId).toBe(incomingTraceId);
		expect(storageSpan?.parentSpanContext?.spanId).toBe(requestSpan?.spanContext().spanId);
		expect(JSON.stringify(requestSpan)).not.toContain("private-user-123");
		expect(JSON.stringify(requestSpan)).not.toContain("fixture-secret");
		const log = JSON.parse(lines[0] ?? "null") as unknown;
		expect(log).toMatchObject({
			severity: "info",
			service: "runtime-test",
			trace_id: incomingTraceId,
			event_name: "request.handled",
			attributes: { userId: "[REDACTED]" },
		});
		const metricNames = metricExporter
			.getMetrics()
			.flatMap((resource) => resource.scopeMetrics)
			.flatMap((scope) => scope.metrics)
			.map((metric) => metric.descriptor.name);
		expect(metricNames).toContain("rezics.http.server.request.count");
	});

	it("sanitizes span attributes and exception events before an in-memory exporter", async () => {
		const lines: string[] = [];
		const { spans } = inMemoryRuntime(lines);
		const secret = "fixture-secret-do-not-export";

		await active?.tracer.startActiveSpan("unsafe", async (span) => {
			span.setAttributes({
				"http.request.method": "GET",
				"url.full": `https://example.test/path?token=${secret}`,
				authorization: `Bearer ${secret}`,
				"error.type": `token=${secret}`,
			});
			span.recordException(new Error(`token=${secret}`));
			await Promise.resolve();
			expect(trace.getActiveSpan()?.spanContext().spanId).toBe(span.spanContext().spanId);
			span.end();
		});

		const serialized = JSON.stringify(
			spans.getFinishedSpans().map((span) => ({
				name: span.name,
				attributes: span.attributes,
				events: span.events,
			})),
		);
		expect(serialized).not.toContain(secret);
		expect(serialized).not.toContain("url.full");
		expect(serialized).not.toContain("authorization");
	});

	it("records bounded dependency metrics without business identifiers", async () => {
		const lines: string[] = [];
		const { metricExporter } = inMemoryRuntime(lines);

		await withDependencySpan({ dependency: "s3", operation: "get" }, async () => "value");
		await active?.flush();

		const serialized = JSON.stringify(metricExporter.getMetrics());
		expect(serialized).toContain("rezics.dependency.duration");
		expect(serialized).toContain("dependency.name");
		expect(serialized).toContain("s3");
	});

	it("records bounded readiness and worker-health metrics", async () => {
		const lines: string[] = [];
		const { metricExporter } = inMemoryRuntime(lines);

		active?.metrics.readinessCheckFinished("database", "unavailable", 12, "timeout");
		active?.metrics.readinessTransition("ready", "not_ready");
		active?.metrics.workerHeartbeat(Date.now() - 1_000);
		await active?.flush();

		const serialized = JSON.stringify(metricExporter.getMetrics());
		expect(serialized).toContain("rezics.readiness.check.duration");
		expect(serialized).toContain("rezics.readiness.check.failures");
		expect(serialized).toContain("rezics.readiness.transitions");
		expect(serialized).toContain("rezics.worker.heartbeat.age");
		expect(serialized).toContain("rezics.worker.job.active_age");
		expect(serialized).not.toContain("userId");
	});

	it("rejects repeated initialization instead of duplicating providers", () => {
		const lines: string[] = [];
		inMemoryRuntime(lines);

		expect(() =>
			initializeObservability({
				service: { name: "duplicate", version: "1.0.0", environment: "test" },
			}),
		).toThrow(/already initialized/);
	});

	it("keeps exporter failure non-fatal with a bounded trace queue", async () => {
		const lines: string[] = [];
		active = initializeObservability({
			service: { name: "unreachable-test", version: "1.0.0", environment: "test" },
			environmentVariables: {
				OTEL_EXPORTER_OTLP_ENDPOINT: "http://127.0.0.1:1",
				OTEL_TRACES_EXPORTER: "otlp",
				OTEL_METRICS_EXPORTER: "none",
				OTEL_TRACES_SAMPLER: "always_on",
				OTEL_BSP_MAX_QUEUE_SIZE: "8",
				OTEL_BSP_MAX_EXPORT_BATCH_SIZE: "4",
				OTEL_EXPORTER_OTLP_TIMEOUT: "100",
				REZICS_OBSERVABILITY_SHUTDOWN_TIMEOUT_MS: "250",
			},
			overrides: { logWriter: (line) => lines.push(line) },
		});
		for (let index = 0; index < 100; index += 1) {
			const span = active.tracer.startSpan("bounded");
			span.end();
		}

		await expect(active.flush()).resolves.toBeUndefined();
		expect(lines.filter((line) => line.includes("TelemetryExporterUnhealthy"))).toHaveLength(1);
	});

	it("exports the same runtime through Aspire-style and manual OTLP endpoints", async () => {
		const paths: string[] = [];
		const server = createServer((request, response) => {
			paths.push(request.url ?? "");
			request.resume();
			response.writeHead(200).end();
		});
		const port = await listen(server);
		try {
			active = initializeObservability({
				service: { name: "otlp-base", version: "1.0.0", environment: "test" },
				environmentVariables: {
					OTEL_EXPORTER_OTLP_ENDPOINT: `http://127.0.0.1:${port}`,
					OTEL_TRACES_SAMPLER: "always_on",
					OTEL_EXPORTER_OTLP_TIMEOUT: "1000",
				},
				overrides: { logWriter: () => undefined },
			});
			active.tracer.startSpan("base-endpoint").end();
			await active.flush();
			await active.shutdown();
			active = undefined;

			active = initializeObservability({
				service: { name: "otlp-manual", version: "1.0.0", environment: "test" },
				environmentVariables: {
					OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: `http://127.0.0.1:${port}/custom-traces`,
					OTEL_EXPORTER_OTLP_METRICS_ENDPOINT: `http://127.0.0.1:${port}/custom-metrics`,
					OTEL_TRACES_EXPORTER: "otlp",
					OTEL_METRICS_EXPORTER: "otlp",
					OTEL_TRACES_SAMPLER: "always_on",
					OTEL_EXPORTER_OTLP_TIMEOUT: "1000",
				},
				overrides: { logWriter: () => undefined },
			});
			active.tracer.startSpan("manual-endpoint").end();
			await active.flush();

			expect(paths).toContain("/v1/traces");
			expect(paths).toContain("/v1/metrics");
			expect(paths).toContain("/custom-traces");
			expect(paths).toContain("/custom-metrics");
		} finally {
			server.close();
			await once(server, "close");
		}
	});
});
