import {
	context,
	diag,
	DiagLogLevel,
	metrics,
	propagation,
	trace,
	type DiagLogger,
	type Tracer,
} from "@opentelemetry/api";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { ExportResultCode, W3CTraceContextPropagator } from "@opentelemetry/core";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-proto";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
	AggregationTemporality,
	MeterProvider,
	PeriodicExportingMetricReader,
	type InstrumentType,
	type MetricReader,
	type PushMetricExporter,
	type ResourceMetrics,
} from "@opentelemetry/sdk-metrics";
import {
	AlwaysOffSampler,
	AlwaysOnSampler,
	BatchSpanProcessor,
	ParentBasedSampler,
	SimpleSpanProcessor,
	TraceIdRatioBasedSampler,
	type Sampler,
	type SpanExporter,
	type SpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";

import {
	resolveObservabilityConfiguration,
	type InitializeObservabilityOptions,
	type ResolvedObservabilityConfiguration,
} from "./config";
import { createStructuredLogger, type StructuredLogger } from "./logger";
import { ObservabilityMetrics } from "./metrics";
import { RedactingSpanExporter } from "./redaction";
import {
	clearActiveObservability,
	peekActiveObservability,
	setActiveObservability,
	type ActiveObservability,
} from "./state";

export interface ObservabilityHandle extends ActiveObservability {
	flush(): Promise<void>;
	shutdown(): Promise<void>;
}

function sampler(configuration: ResolvedObservabilityConfiguration): Sampler {
	const ratioSampler = new TraceIdRatioBasedSampler(configuration.traces.samplerRatio);
	switch (configuration.traces.sampler) {
		case "always_on":
			return new AlwaysOnSampler();
		case "always_off":
			return new AlwaysOffSampler();
		case "traceidratio":
			return ratioSampler;
		case "parentbased_always_on":
			return new ParentBasedSampler({ root: new AlwaysOnSampler() });
		case "parentbased_always_off":
			return new ParentBasedSampler({ root: new AlwaysOffSampler() });
		case "parentbased_traceidratio":
			return new ParentBasedSampler({ root: ratioSampler });
	}
}

function spanExporter(
	configuration: ResolvedObservabilityConfiguration,
	override: SpanExporter | undefined,
	reportFailure: (error: unknown) => void,
): { exporter?: SpanExporter; override: boolean } {
	if (override)
		return {
			exporter: new RedactingSpanExporter(override, configuration.production, reportFailure),
			override: true,
		};
	if (configuration.traces.selection === "none") return { override: false };
	return {
		exporter: new RedactingSpanExporter(
			new OTLPTraceExporter({
				url: configuration.traces.url,
				headers: { ...configuration.traces.headers },
				timeoutMillis: configuration.traces.timeoutMillis,
				concurrencyLimit: 1,
			}),
			configuration.production,
			reportFailure,
		),
		override: false,
	};
}

function metricReader(
	configuration: ResolvedObservabilityConfiguration,
	override: MetricReader | undefined,
	reportFailure: (error: unknown) => void,
): MetricReader | undefined {
	if (override) return override;
	if (configuration.metrics.selection === "none") return undefined;
	return new PeriodicExportingMetricReader({
		exporter: new ReportingMetricExporter(
			new OTLPMetricExporter({
				url: configuration.metrics.url,
				headers: { ...configuration.metrics.headers },
				timeoutMillis: configuration.metrics.timeoutMillis,
				concurrencyLimit: 1,
			}),
			reportFailure,
		),
		exportIntervalMillis: configuration.metrics.exportIntervalMillis,
		exportTimeoutMillis: configuration.metrics.exportTimeoutMillis,
		cardinalityLimits: { default: 128 },
		maxExportBatchSize: 128,
	});
}

class ReportingMetricExporter implements PushMetricExporter {
	readonly #delegate: PushMetricExporter;
	readonly #reportFailure: (error: unknown) => void;

	constructor(delegate: PushMetricExporter, reportFailure: (error: unknown) => void) {
		this.#delegate = delegate;
		this.#reportFailure = reportFailure;
	}

	export(
		metrics: ResourceMetrics,
		resultCallback: Parameters<PushMetricExporter["export"]>[1],
	): void {
		this.#delegate.export(metrics, (result) => {
			if (result.code === ExportResultCode.FAILED) this.#reportFailure(result.error);
			resultCallback(result);
		});
	}

	forceFlush(): Promise<void> {
		return this.#delegate.forceFlush();
	}

	selectAggregationTemporality(instrumentType: InstrumentType): AggregationTemporality {
		return (
			this.#delegate.selectAggregationTemporality?.(instrumentType) ??
			AggregationTemporality.CUMULATIVE
		);
	}

	shutdown(): Promise<void> {
		return this.#delegate.shutdown();
	}
}

function createDiagnosticReporter(logger: StructuredLogger): (error: unknown) => void {
	let lastDiagnosticAt = 0;
	let writing = false;
	return (error: unknown) => {
		const now = Date.now();
		if (writing || now - lastDiagnosticAt < 60_000) return;
		lastDiagnosticAt = now;
		writing = true;
		try {
			logger.error("OpenTelemetry exporter diagnostic", {
				eventName: "observability.exporter.diagnostic",
				errorCode: "TelemetryExporterUnhealthy",
				error,
			});
		} finally {
			writing = false;
		}
	};
}

function createDiagnosticLogger(reportFailure: (error: unknown) => void): DiagLogger {
	function report(message: string, args: unknown[]): void {
		reportFailure({ message, details: args });
	}
	return {
		error: (message, ...args) => report(message, args),
		warn: (message, ...args) => report(message, args),
		info: () => undefined,
		debug: () => undefined,
		verbose: () => undefined,
	};
}

function reportLifecycleFailure(logger: StructuredLogger, operation: string, error: unknown): void {
	logger.warn(`Observability ${operation} did not complete cleanly`, {
		eventName: `observability.${operation}.failed`,
		errorCode: "TelemetryLifecycleFailure",
		error,
	});
}

async function settleWithin(
	operation: Promise<void>,
	timeoutMillis: number,
	logger: StructuredLogger,
	name: string,
): Promise<void> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const timeout = new Promise<void>((resolve) => {
		timer = setTimeout(() => {
			reportLifecycleFailure(logger, name, new Error(`Timed out after ${timeoutMillis}ms`));
			resolve();
		}, timeoutMillis);
		timer.unref?.();
	});
	await Promise.race([
		operation.catch((error: unknown) => reportLifecycleFailure(logger, name, error)),
		timeout,
	]);
	if (timer) clearTimeout(timer);
}

export function initializeObservability(
	options: InitializeObservabilityOptions,
): ObservabilityHandle {
	if (peekActiveObservability())
		throw new Error("@rezics/observability is already initialized in this process");
	const configuration = resolveObservabilityConfiguration(options);
	const logger = createStructuredLogger(
		configuration.service,
		configuration.production,
		options.overrides?.logWriter,
	);
	const resource = resourceFromAttributes({
		...configuration.resourceAttributes,
		"service.name": configuration.service.name,
		"service.version": configuration.service.version,
		"service.instance.id": configuration.service.instanceId,
		"deployment.environment.name": configuration.service.environment,
		"vcs.ref.head.revision": configuration.service.commitRevision,
	});
	const reportExporterFailure = createDiagnosticReporter(logger);
	const processors: SpanProcessor[] = [];
	const configuredSpanExporter = spanExporter(
		configuration,
		options.overrides?.spanExporter,
		reportExporterFailure,
	);
	if (configuredSpanExporter.exporter)
		processors.push(
			configuredSpanExporter.override
				? new SimpleSpanProcessor(configuredSpanExporter.exporter)
				: new BatchSpanProcessor(configuredSpanExporter.exporter, {
						maxQueueSize: configuration.traces.maxQueueSize,
						maxExportBatchSize: configuration.traces.maxExportBatchSize,
						scheduledDelayMillis: configuration.traces.scheduledDelayMillis,
						exportTimeoutMillis: configuration.traces.timeoutMillis,
					}),
		);
	const tracerProvider = new NodeTracerProvider({
		resource,
		sampler: sampler(configuration),
		spanProcessors: processors,
		forceFlushTimeoutMillis: configuration.lifecycleTimeoutMillis,
		spanLimits: {
			attributeCountLimit: 32,
			attributeValueLengthLimit: 1_024,
			eventCountLimit: 16,
			linkCountLimit: 8,
		},
	});
	const contextManager = new AsyncLocalStorageContextManager();
	tracerProvider.register({
		contextManager,
		propagator: new W3CTraceContextPropagator(),
	});
	const configuredMetricReader = metricReader(
		configuration,
		options.overrides?.metricReader,
		reportExporterFailure,
	);
	const meterProvider = new MeterProvider({
		resource,
		readers: configuredMetricReader ? [configuredMetricReader] : [],
	});
	metrics.setGlobalMeterProvider(meterProvider);
	const tracer: Tracer = tracerProvider.getTracer(
		"@rezics/observability",
		configuration.service.version,
	);
	const observabilityMetrics = new ObservabilityMetrics(
		meterProvider.getMeter("@rezics/observability", configuration.service.version),
	);
	const active: ActiveObservability = {
		configuration,
		logger,
		metrics: observabilityMetrics,
		tracer,
	};
	setActiveObservability(active);
	diag.setLogger(createDiagnosticLogger(reportExporterFailure), {
		logLevel: DiagLogLevel.WARN,
		suppressOverrideMessage: true,
	});

	let shutdownPromise: Promise<void> | undefined;
	async function flush(): Promise<void> {
		await settleWithin(
			Promise.all([tracerProvider.forceFlush(), meterProvider.forceFlush()]).then(
				() => undefined,
			),
			configuration.lifecycleTimeoutMillis,
			logger,
			"flush",
		);
	}
	function shutdown(): Promise<void> {
		if (shutdownPromise) return shutdownPromise;
		shutdownPromise = (async () => {
			await flush();
			await settleWithin(
				Promise.all([tracerProvider.shutdown(), meterProvider.shutdown()]).then(
					() => undefined,
				),
				configuration.lifecycleTimeoutMillis,
				logger,
				"shutdown",
			);
			contextManager.disable();
			trace.disable();
			metrics.disable();
			context.disable();
			propagation.disable();
			diag.disable();
			clearActiveObservability(active);
		})();
		return shutdownPromise;
	}

	return { ...active, flush, shutdown };
}
