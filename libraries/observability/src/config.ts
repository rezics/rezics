import type { MetricReader } from "@opentelemetry/sdk-metrics";
import type { SpanExporter } from "@opentelemetry/sdk-trace-base";

export type EnvironmentVariables = Readonly<Record<string, string | undefined>>;

export interface ServiceIdentityInput {
	name: string;
	version: string;
	environment: string;
	instanceId?: string;
	commitRevision?: string;
}

export interface ObservabilityFeatureFlags {
	http: boolean;
	database: boolean;
	storage: boolean;
	worker: boolean;
}

export interface ObservabilityOverrides {
	spanExporter?: SpanExporter;
	metricReader?: MetricReader;
	logWriter?: (line: string, severity: LogSeverity) => void;
}

export interface InitializeObservabilityOptions {
	service: ServiceIdentityInput;
	environmentVariables?: EnvironmentVariables;
	overrides?: ObservabilityOverrides;
}

export type LogSeverity = "debug" | "info" | "warn" | "error";
export type ExporterSelection = "none" | "otlp";
export type SamplerSelection =
	| "always_on"
	| "always_off"
	| "traceidratio"
	| "parentbased_always_on"
	| "parentbased_always_off"
	| "parentbased_traceidratio";

interface OtlpSignalConfiguration {
	selection: ExporterSelection;
	url?: string;
	headers: Readonly<Record<string, string>>;
	timeoutMillis: number;
}

export interface ResolvedObservabilityConfiguration {
	disabled: boolean;
	service: Required<ServiceIdentityInput>;
	resourceAttributes: Readonly<Record<string, string>>;
	features: ObservabilityFeatureFlags;
	traces: OtlpSignalConfiguration & {
		sampler: SamplerSelection;
		samplerRatio: number;
		maxQueueSize: number;
		maxExportBatchSize: number;
		scheduledDelayMillis: number;
	};
	metrics: OtlpSignalConfiguration & {
		exportIntervalMillis: number;
		exportTimeoutMillis: number;
	};
	lifecycleTimeoutMillis: number;
	production: boolean;
}

const ResourceKey = /^[a-z][a-z0-9_.-]{0,127}$/;
const IdentityValue = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/;
const SensitiveResourceKey =
	/(?:^|[._-])(authorization|cookie|credential|email|password|secret|session|token|user)(?:$|[._-])/i;

function requiredIdentity(value: string, field: string): string {
	const normalized = value.trim();
	if (!IdentityValue.test(normalized))
		throw new Error(
			`Observability ${field} must be 1-256 characters using letters, numbers, dot, underscore, colon, slash, or hyphen`,
		);
	return normalized;
}

function optionalIdentity(value: string | undefined, field: string): string | undefined {
	if (value === undefined || value.trim() === "") return undefined;
	return requiredIdentity(value, field);
}

function booleanValue(value: string | undefined, fallback: boolean, name: string): boolean {
	if (value === undefined || value.trim() === "") return fallback;
	switch (value.trim().toLowerCase()) {
		case "true":
			return true;
		case "false":
			return false;
		default:
			throw new Error(`${name} must be true or false`);
	}
}

function integerValue(
	value: string | undefined,
	fallback: number,
	name: string,
	minimum: number,
	maximum: number,
): number {
	if (value === undefined || value.trim() === "") return fallback;
	if (!/^\d+$/.test(value.trim())) throw new Error(`${name} must be an integer`);
	const parsed = Number(value);
	if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum)
		throw new Error(`${name} must be between ${minimum} and ${maximum}`);
	return parsed;
}

function ratioValue(value: string | undefined): number {
	if (value === undefined || value.trim() === "") return 0.1;
	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1)
		throw new Error("OTEL_TRACES_SAMPLER_ARG must be a number between 0 and 1");
	return parsed;
}

function enumValue<T extends string>(
	value: string | undefined,
	fallback: T,
	name: string,
	allowed: readonly T[],
): T {
	if (value === undefined || value.trim() === "") return fallback;
	const normalized = value.trim().toLowerCase();
	if (!allowed.some((candidate) => candidate === normalized))
		throw new Error(`${name} must be one of: ${allowed.join(", ")}`);
	const matched = allowed.find((candidate) => candidate === normalized);
	if (!matched) throw new Error(`${name} must be one of: ${allowed.join(", ")}`);
	return matched;
}

function parseEndpoint(value: string | undefined, name: string): string | undefined {
	if (value === undefined || value.trim() === "") return undefined;
	let endpoint: URL;
	try {
		endpoint = new URL(value);
	} catch {
		throw new Error(`${name} must be a valid URL`);
	}
	if (endpoint.protocol !== "http:" && endpoint.protocol !== "https:")
		throw new Error(`${name} must use HTTP or HTTPS`);
	if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash)
		throw new Error(`${name} must not contain credentials, a query, or a fragment`);
	return endpoint.toString();
}

function signalEndpoint(
	base: string | undefined,
	signal: string | undefined,
	signalName: "traces" | "metrics",
): string | undefined {
	if (signal) return signal;
	if (!base) return undefined;
	const endpoint = new URL(base);
	if (!endpoint.pathname.endsWith("/")) endpoint.pathname += "/";
	endpoint.pathname += `v1/${signalName}`;
	return endpoint.toString();
}

function parseHeaders(value: string | undefined, name: string): Readonly<Record<string, string>> {
	if (value === undefined || value.trim() === "") return {};
	const headers: Record<string, string> = {};
	for (const entry of value.split(",")) {
		const separator = entry.indexOf("=");
		if (separator < 1) throw new Error(`${name} must contain comma-separated key=value pairs`);
		let key: string;
		let headerValue: string;
		try {
			key = decodeURIComponent(entry.slice(0, separator).trim());
			headerValue = decodeURIComponent(entry.slice(separator + 1).trim());
		} catch {
			throw new Error(`${name} contains invalid percent encoding`);
		}
		if (
			!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(key) ||
			headerValue.includes("\r") ||
			headerValue.includes("\n")
		)
			throw new Error(`${name} contains an invalid HTTP header`);
		headers[key] = headerValue;
	}
	return headers;
}

function parseResourceAttributes(value: string | undefined): Readonly<Record<string, string>> {
	if (value === undefined || value.trim() === "") return {};
	const attributes: Record<string, string> = {};
	for (const entry of value.split(",")) {
		const separator = entry.indexOf("=");
		if (separator < 1)
			throw new Error(
				"OTEL_RESOURCE_ATTRIBUTES must contain comma-separated key=value pairs",
			);
		let key: string;
		let attributeValue: string;
		try {
			key = decodeURIComponent(entry.slice(0, separator).trim());
			attributeValue = decodeURIComponent(entry.slice(separator + 1).trim());
		} catch {
			throw new Error("OTEL_RESOURCE_ATTRIBUTES contains invalid percent encoding");
		}
		if (!ResourceKey.test(key)) throw new Error(`Invalid OpenTelemetry resource key: ${key}`);
		if (SensitiveResourceKey.test(key))
			throw new Error(`Sensitive resource attribute is prohibited: ${key}`);
		if (
			attributeValue.length < 1 ||
			attributeValue.length > 256 ||
			/[\r\n]/.test(attributeValue)
		)
			throw new Error(
				`OpenTelemetry resource attribute ${key} must contain 1-256 safe characters`,
			);
		attributes[key] = attributeValue;
	}
	return attributes;
}

function resolveExporterSelection(
	value: string | undefined,
	hasEndpoint: boolean,
	name: string,
): ExporterSelection {
	return enumValue(value, hasEndpoint ? "otlp" : "none", name, ["none", "otlp"] as const);
}

export function resolveObservabilityConfiguration(
	options: InitializeObservabilityOptions,
): ResolvedObservabilityConfiguration {
	const environment = options.environmentVariables ?? process.env;
	const resourceAttributes = parseResourceAttributes(environment.OTEL_RESOURCE_ATTRIBUTES);
	const baseEndpoint = parseEndpoint(
		environment.OTEL_EXPORTER_OTLP_ENDPOINT,
		"OTEL_EXPORTER_OTLP_ENDPOINT",
	);
	const tracesEndpoint = parseEndpoint(
		environment.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
		"OTEL_EXPORTER_OTLP_TRACES_ENDPOINT",
	);
	const metricsEndpoint = parseEndpoint(
		environment.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT,
		"OTEL_EXPORTER_OTLP_METRICS_ENDPOINT",
	);
	const protocol = enumValue(
		environment.OTEL_EXPORTER_OTLP_PROTOCOL,
		"http/protobuf",
		"OTEL_EXPORTER_OTLP_PROTOCOL",
		["http/protobuf"] as const,
	);
	const traceProtocol = enumValue(
		environment.OTEL_EXPORTER_OTLP_TRACES_PROTOCOL,
		protocol,
		"OTEL_EXPORTER_OTLP_TRACES_PROTOCOL",
		["http/protobuf"] as const,
	);
	const metricProtocol = enumValue(
		environment.OTEL_EXPORTER_OTLP_METRICS_PROTOCOL,
		protocol,
		"OTEL_EXPORTER_OTLP_METRICS_PROTOCOL",
		["http/protobuf"] as const,
	);
	void traceProtocol;
	void metricProtocol;
	for (const [name, value] of [
		["OTEL_EXPORTER_OTLP_COMPRESSION", environment.OTEL_EXPORTER_OTLP_COMPRESSION],
		[
			"OTEL_EXPORTER_OTLP_TRACES_COMPRESSION",
			environment.OTEL_EXPORTER_OTLP_TRACES_COMPRESSION,
		],
		[
			"OTEL_EXPORTER_OTLP_METRICS_COMPRESSION",
			environment.OTEL_EXPORTER_OTLP_METRICS_COMPRESSION,
		],
	] as const)
		enumValue(value, "none", name, ["none", "gzip"] as const);

	const defaultHeaders = parseHeaders(
		environment.OTEL_EXPORTER_OTLP_HEADERS,
		"OTEL_EXPORTER_OTLP_HEADERS",
	);
	const traceHeaders = environment.OTEL_EXPORTER_OTLP_TRACES_HEADERS
		? parseHeaders(
				environment.OTEL_EXPORTER_OTLP_TRACES_HEADERS,
				"OTEL_EXPORTER_OTLP_TRACES_HEADERS",
			)
		: defaultHeaders;
	const metricHeaders = environment.OTEL_EXPORTER_OTLP_METRICS_HEADERS
		? parseHeaders(
				environment.OTEL_EXPORTER_OTLP_METRICS_HEADERS,
				"OTEL_EXPORTER_OTLP_METRICS_HEADERS",
			)
		: defaultHeaders;
	const production = options.service.environment === "production";
	const instanceId =
		optionalIdentity(
			options.service.instanceId ?? resourceAttributes["service.instance.id"],
			"service instance ID",
		) ?? crypto.randomUUID();
	const commitRevision =
		optionalIdentity(
			options.service.commitRevision ??
				resourceAttributes["vcs.ref.head.revision"] ??
				environment.GIT_COMMIT_SHA ??
				environment.SOURCE_VERSION,
			"commit revision",
		) ?? "unknown";
	const service = {
		name: requiredIdentity(
			environment.OTEL_SERVICE_NAME ?? options.service.name,
			"service name",
		),
		version: requiredIdentity(options.service.version, "service version"),
		environment: requiredIdentity(options.service.environment, "deployment environment"),
		instanceId,
		commitRevision,
	};
	const timeout = integerValue(
		environment.OTEL_EXPORTER_OTLP_TIMEOUT,
		10_000,
		"OTEL_EXPORTER_OTLP_TIMEOUT",
		100,
		120_000,
	);
	const maxQueueSize = integerValue(
		environment.OTEL_BSP_MAX_QUEUE_SIZE,
		512,
		"OTEL_BSP_MAX_QUEUE_SIZE",
		1,
		8_192,
	);
	const maxExportBatchSize = integerValue(
		environment.OTEL_BSP_MAX_EXPORT_BATCH_SIZE,
		128,
		"OTEL_BSP_MAX_EXPORT_BATCH_SIZE",
		1,
		maxQueueSize,
	);
	const metricExportIntervalMillis = integerValue(
		environment.OTEL_METRIC_EXPORT_INTERVAL,
		60_000,
		"OTEL_METRIC_EXPORT_INTERVAL",
		1_000,
		300_000,
	);
	const metricExportTimeoutMillis = integerValue(
		environment.OTEL_METRIC_EXPORT_TIMEOUT,
		Math.min(30_000, metricExportIntervalMillis),
		"OTEL_METRIC_EXPORT_TIMEOUT",
		100,
		120_000,
	);
	if (metricExportTimeoutMillis > metricExportIntervalMillis)
		throw new Error(
			"OTEL_METRIC_EXPORT_TIMEOUT must be less than or equal to OTEL_METRIC_EXPORT_INTERVAL",
		);

	return {
		disabled: booleanValue(environment.OTEL_SDK_DISABLED, false, "OTEL_SDK_DISABLED"),
		service,
		resourceAttributes,
		features: {
			http: booleanValue(
				environment.REZICS_OBSERVABILITY_HTTP_ENABLED,
				true,
				"REZICS_OBSERVABILITY_HTTP_ENABLED",
			),
			database: booleanValue(
				environment.REZICS_OBSERVABILITY_DATABASE_ENABLED,
				true,
				"REZICS_OBSERVABILITY_DATABASE_ENABLED",
			),
			storage: booleanValue(
				environment.REZICS_OBSERVABILITY_STORAGE_ENABLED,
				true,
				"REZICS_OBSERVABILITY_STORAGE_ENABLED",
			),
			worker: booleanValue(
				environment.REZICS_OBSERVABILITY_WORKER_ENABLED,
				true,
				"REZICS_OBSERVABILITY_WORKER_ENABLED",
			),
		},
		traces: {
			selection: resolveExporterSelection(
				environment.OTEL_TRACES_EXPORTER,
				Boolean(baseEndpoint || tracesEndpoint),
				"OTEL_TRACES_EXPORTER",
			),
			url: signalEndpoint(baseEndpoint, tracesEndpoint, "traces"),
			headers: traceHeaders,
			timeoutMillis: integerValue(
				environment.OTEL_EXPORTER_OTLP_TRACES_TIMEOUT,
				timeout,
				"OTEL_EXPORTER_OTLP_TRACES_TIMEOUT",
				100,
				120_000,
			),
			sampler: enumValue(
				environment.OTEL_TRACES_SAMPLER,
				"parentbased_traceidratio",
				"OTEL_TRACES_SAMPLER",
				[
					"always_on",
					"always_off",
					"traceidratio",
					"parentbased_always_on",
					"parentbased_always_off",
					"parentbased_traceidratio",
				] as const,
			),
			samplerRatio: ratioValue(environment.OTEL_TRACES_SAMPLER_ARG),
			maxQueueSize,
			maxExportBatchSize,
			scheduledDelayMillis: integerValue(
				environment.OTEL_BSP_SCHEDULE_DELAY,
				5_000,
				"OTEL_BSP_SCHEDULE_DELAY",
				100,
				60_000,
			),
		},
		metrics: {
			selection: resolveExporterSelection(
				environment.OTEL_METRICS_EXPORTER,
				Boolean(baseEndpoint || metricsEndpoint),
				"OTEL_METRICS_EXPORTER",
			),
			url: signalEndpoint(baseEndpoint, metricsEndpoint, "metrics"),
			headers: metricHeaders,
			timeoutMillis: integerValue(
				environment.OTEL_EXPORTER_OTLP_METRICS_TIMEOUT,
				timeout,
				"OTEL_EXPORTER_OTLP_METRICS_TIMEOUT",
				100,
				120_000,
			),
			exportIntervalMillis: metricExportIntervalMillis,
			exportTimeoutMillis: metricExportTimeoutMillis,
		},
		lifecycleTimeoutMillis: integerValue(
			environment.REZICS_OBSERVABILITY_SHUTDOWN_TIMEOUT_MS,
			5_000,
			"REZICS_OBSERVABILITY_SHUTDOWN_TIMEOUT_MS",
			100,
			30_000,
		),
		production,
	};
}
