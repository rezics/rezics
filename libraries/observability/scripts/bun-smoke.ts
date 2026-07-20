import {
	AggregationTemporality,
	InMemoryMetricExporter,
	PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";
import { InMemorySpanExporter } from "@opentelemetry/sdk-trace-base";
import Elysia from "elysia";

import { createElysiaObservability } from "../src/elysia.ts";
import { initializeObservability } from "../src/runtime.ts";
import { instrumentPostgresClient, withDependencySpan } from "../src/operations.ts";

function assert(condition: boolean, message: string): asserts condition {
	if (!condition) throw new Error(message);
}

const lines: string[] = [];
const spans = new InMemorySpanExporter();
const metricExporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);
const metricReader = new PeriodicExportingMetricReader({
	exporter: metricExporter,
	exportIntervalMillis: 60_000,
	exportTimeoutMillis: 1_000,
	cardinalityLimits: { default: 32 },
});
const observability = initializeObservability({
	service: { name: "bun-smoke", version: "1.0.0", environment: "test" },
	environmentVariables: { OTEL_TRACES_SAMPLER: "always_on" },
	overrides: {
		spanExporter: spans,
		metricReader,
		logWriter: (line) => lines.push(line),
	},
});

try {
	const { Pool } = await import("pg");
	const client = instrumentPostgresClient(
		new Pool({
			connectionString: "postgres://smoke:smoke@127.0.0.1:1/smoke",
			connectionTimeoutMillis: 100,
		}),
	);
	await client.query("select 1").catch(() => undefined);
	await client.end();
	await withDependencySpan({ dependency: "postgresql", operation: "smoke" }, async () => {
		await Promise.resolve();
		observability.logger.info("Bun async context is active", {
			eventName: "bun.smoke.active",
		});
	});
	const app = new Elysia().use(createElysiaObservability()).get("/smoke/:id", () => "ok");
	const response = await app.handle(new Request("http://localhost/smoke/private-id"));
	await new Promise<void>((resolve) => setTimeout(resolve, 0));
	await observability.flush();

	assert(response.status === 200, "Elysia request instrumentation failed under Bun");
	assert(spans.getFinishedSpans().length >= 3, "Bun did not export the expected spans");
	assert(
		spans.getFinishedSpans().some((span) => span.attributes["db.system.name"] === "postgresql"),
		"PostgreSQL client instrumentation did not create a Bun span",
	);
	assert(
		lines.some((line) => line.includes('"trace_id"')),
		"Bun lost async trace/log correlation",
	);
	assert(
		JSON.stringify(metricExporter.getMetrics()).includes("rezics.dependency.duration"),
		"Bun did not export dependency metrics",
	);
} finally {
	await observability.shutdown();
}

process.stdout.write("Bun OpenTelemetry compatibility smoke test passed.\n");
