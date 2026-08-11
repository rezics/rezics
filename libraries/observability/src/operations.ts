import {
	context as otelContext,
	type Context,
	SpanKind,
	SpanStatusCode,
	trace,
} from "@opentelemetry/api";

import { normalizeOperationName, type DependencyName } from "./metrics";
import { getActiveObservability, peekActiveObservability } from "./state";

export interface DependencySpanOptions {
	dependency: DependencyName;
	operation: string;
}

export interface WorkerSpanOptions {
	name: string;
	retryCount: number;
}

function dependencyEnabled(
	dependency: DependencyName,
	features: ReturnType<typeof getActiveObservability>["configuration"]["features"],
): boolean {
	if (dependency === "postgresql") return features.database;
	if (dependency === "s3") return features.storage;
	return true;
}

export async function withDependencySpan<T>(
	options: DependencySpanOptions,
	work: () => Promise<T>,
): Promise<T> {
	const observability = peekActiveObservability();
	const operation = normalizeOperationName(options.operation);
	if (
		!observability ||
		observability.configuration.disabled ||
		!dependencyEnabled(options.dependency, observability.configuration.features)
	)
		return work();
	const startedAt = performance.now();
	return observability.tracer.startActiveSpan(
		`${options.dependency}.${operation}`,
		{
			kind: SpanKind.CLIENT,
			attributes: {
				"dependency.name": options.dependency,
				"dependency.operation": operation,
				...(options.dependency === "postgresql" ? { "db.system.name": "postgresql" } : {}),
			},
		},
		async (span) => {
			try {
				const result = await work();
				observability.metrics.dependencyFinished(
					options.dependency,
					operation,
					performance.now() - startedAt,
					false,
				);
				return result;
			} catch (error) {
				span.setStatus({ code: SpanStatusCode.ERROR });
				span.recordException(
					error instanceof Error ? error : new Error("Unknown dependency failure"),
				);
				observability.metrics.dependencyFinished(
					options.dependency,
					operation,
					performance.now() - startedAt,
					true,
				);
				throw error;
			} finally {
				span.end();
			}
		},
	);
}

export async function observedFetch(
	options: DependencySpanOptions,
	input: string | URL | Request,
	init?: RequestInit,
): Promise<Response> {
	return withDependencySpan(options, () => fetch(input, init));
}

const instrumentedPostgresClients = new WeakMap<object, object>();

function createInstrumentedPostgresClient<T extends object>(
	client: T,
	boundContext?: Context,
	cacheSource = true,
): T {
	const existing = cacheSource ? instrumentedPostgresClients.get(client) : undefined;
	// The map stores only proxies created from this exact client and therefore preserves T's surface.
	if (existing) return existing as T;
	const instrumented = new Proxy(client, {
		get(target, property, receiver): unknown {
			const value: unknown = Reflect.get(target, property, receiver);
			if (property === "connect" && typeof value === "function")
				return (...arguments_: unknown[]) => {
					const connectionContext = otelContext.active();
					const callback = arguments_.at(-1);
					if (typeof callback === "function") {
						const wrappedArguments = arguments_.slice(0, -1);
						wrappedArguments.push((error: unknown, connected: unknown, ...rest: unknown[]) =>
							otelContext.with(connectionContext, () =>
								Reflect.apply(callback, undefined, [
									error,
									connected !== null && typeof connected === "object"
										? createInstrumentedPostgresClient(connected, connectionContext, false)
										: connected,
									...rest,
								]),
							),
						);
						return Reflect.apply(value, target, wrappedArguments);
					}
					return Promise.resolve(Reflect.apply(value, target, arguments_)).then((connected) =>
						connected !== null && typeof connected === "object"
							? createInstrumentedPostgresClient(connected, connectionContext, false)
							: connected,
					);
				};
			if (property !== "query" || typeof value !== "function") return value;
			return (...arguments_: unknown[]) => {
				if (typeof arguments_.at(-1) === "function")
					return Reflect.apply(value, target, arguments_);
				const query = () =>
					withDependencySpan({ dependency: "postgresql", operation: "query" }, () =>
						Promise.resolve(Reflect.apply(value, target, arguments_)),
					);
				return boundContext ? otelContext.with(boundContext, query) : query();
			};
		},
	});
	if (cacheSource) instrumentedPostgresClients.set(client, instrumented);
	instrumentedPostgresClients.set(instrumented, instrumented);
	return instrumented;
}

export function instrumentPostgresClient<T extends object>(client: T): T {
	return createInstrumentedPostgresClient(client);
}

export async function runWorkerJob<T>(
	options: WorkerSpanOptions,
	work: () => Promise<T>,
): Promise<T> {
	const observability = getActiveObservability();
	const name = normalizeOperationName(options.name);
	if (
		!Number.isSafeInteger(options.retryCount) ||
		options.retryCount < 0 ||
		options.retryCount > 100
	)
		throw new Error("Worker retry count must be an integer between 0 and 100");
	if (observability.configuration.disabled || !observability.configuration.features.worker)
		return work();
	observability.metrics.workerStarted(name);
	const startedAt = performance.now();
	return observability.tracer.startActiveSpan(
		`worker.${name}`,
		{
			kind: SpanKind.CONSUMER,
			attributes: {
				"job.name": name,
				"job.retry_count": options.retryCount,
			},
		},
		async (span) => {
			try {
				const result = await work();
				span.setAttribute("job.result", "completed");
				observability.metrics.workerFinished(name, performance.now() - startedAt, false);
				return result;
			} catch (error) {
				span.setAttribute("job.result", "failed");
				span.setStatus({ code: SpanStatusCode.ERROR });
				span.recordException(error instanceof Error ? error : new Error("Unknown worker failure"));
				observability.logger.error("Worker job failed", {
					eventName: `worker.${name}.failed`,
					errorCode: "WorkerJobFailed",
					error,
				});
				observability.metrics.workerFinished(name, performance.now() - startedAt, true);
				throw error;
			} finally {
				span.end();
			}
		},
	);
}

export function recordDomainFailure(errorCode: string): void {
	const code = normalizeOperationName(errorCode);
	const span = trace.getActiveSpan();
	span?.setAttribute("error.type", code);
	span?.setStatus({ code: SpanStatusCode.ERROR });
}
