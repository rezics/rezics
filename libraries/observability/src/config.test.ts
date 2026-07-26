import { describe, expect, it } from "vitest";

import { resolveObservabilityConfiguration, type EnvironmentVariables } from "./config";

const service = {
	name: "rezics-test",
	version: "1.2.3",
	environment: "test",
} as const;

function resolve(environmentVariables: EnvironmentVariables = {}) {
	return resolveObservabilityConfiguration({ service, environmentVariables });
}

describe("observability environment configuration", () => {
	it("uses no external exporter when tests provide no endpoint", () => {
		const configuration = resolve();

		expect(configuration.traces.selection).toBe("none");
		expect(configuration.metrics.selection).toBe("none");
		expect(configuration.metrics).toMatchObject({
			exportIntervalMillis: 60_000,
			exportTimeoutMillis: 30_000,
		});
		expect(configuration.service.name).toBe("rezics-test");
		expect(configuration.service.instanceId).toMatch(/^[0-9a-f-]{36}$/);
	});

	it("accepts an Aspire-style base endpoint and standard resource identity", () => {
		const configuration = resolve({
			OTEL_EXPORTER_OTLP_ENDPOINT: "http://localhost:4318/collector",
			OTEL_EXPORTER_OTLP_PROTOCOL: "http/protobuf",
			OTEL_SERVICE_NAME: "aspire-main-api",
			OTEL_RESOURCE_ATTRIBUTES:
				"service.instance.id=instance-1,service.namespace=rezics,deployment.environment.name=local",
			OTEL_METRIC_EXPORT_INTERVAL: "1000",
		});

		expect(configuration.traces).toMatchObject({
			selection: "otlp",
			url: "http://localhost:4318/collector/v1/traces",
		});
		expect(configuration.metrics).toMatchObject({
			selection: "otlp",
			url: "http://localhost:4318/collector/v1/metrics",
			exportIntervalMillis: 1_000,
			exportTimeoutMillis: 1_000,
		});
		expect(configuration.service).toMatchObject({
			name: "aspire-main-api",
			instanceId: "instance-1",
		});
	});

	it("uses manually configured signal endpoints exactly as provided", () => {
		const configuration = resolve({
			OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: "https://collector.example/tenant/traces",
			OTEL_EXPORTER_OTLP_METRICS_ENDPOINT: "https://collector.example/tenant/metrics",
			OTEL_TRACES_EXPORTER: "otlp",
			OTEL_METRICS_EXPORTER: "otlp",
			OTEL_EXPORTER_OTLP_HEADERS: "Authorization=Bearer%20opaque",
		});

		expect(configuration.traces.url).toBe("https://collector.example/tenant/traces");
		expect(configuration.metrics.url).toBe("https://collector.example/tenant/metrics");
		expect(configuration.traces.headers).toEqual({ Authorization: "Bearer opaque" });
	});

	it("rejects unsafe or unsupported environment values before exporter creation", () => {
		expect(() =>
			resolve({ OTEL_EXPORTER_OTLP_ENDPOINT: "https://user:secret@collector/" }),
		).toThrow(/credentials/);
		expect(() => resolve({ OTEL_EXPORTER_OTLP_PROTOCOL: "grpc" })).toThrow(/http\/protobuf/);
		expect(() =>
			resolve({ OTEL_RESOURCE_ATTRIBUTES: "enduser.email=test@example.com" }),
		).toThrow(/Sensitive resource attribute/);
		expect(() =>
			resolve({ OTEL_BSP_MAX_QUEUE_SIZE: "8", OTEL_BSP_MAX_EXPORT_BATCH_SIZE: "9" }),
		).toThrow(/between 1 and 8/);
	});

	it("rejects a metric export timeout longer than its interval", () => {
		expect(() =>
			resolve({
				OTEL_METRIC_EXPORT_INTERVAL: "1000",
				OTEL_METRIC_EXPORT_TIMEOUT: "1001",
			}),
		).toThrow(
			"OTEL_METRIC_EXPORT_TIMEOUT must be less than or equal to OTEL_METRIC_EXPORT_INTERVAL",
		);
	});
});
