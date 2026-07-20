import type { Attributes, Counter, Histogram, Meter, UpDownCounter } from "@opentelemetry/api";

export type DependencyName =
	"postgresql" | "s3" | "meilisearch" | "cloudflare-email" | "outbound-http";
export type RequestMethod =
	"GET" | "HEAD" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS" | "OTHER";
export type StatusClass = "1xx" | "2xx" | "3xx" | "4xx" | "5xx" | "unknown";
export type ReadinessState = "ready" | "not_ready";
export type ReadinessCheckState = "ready" | "degraded" | "unavailable";
export type ReadinessFailureCategory =
	"configuration" | "dependency" | "not_ready" | "timeout" | "overall_timeout";

const StableName = /^[a-z][a-z0-9_.-]{0,63}$/;

export function normalizeRequestMethod(method: string): RequestMethod {
	const normalized = method.toUpperCase();
	switch (normalized) {
		case "GET":
		case "HEAD":
		case "POST":
		case "PUT":
		case "PATCH":
		case "DELETE":
		case "OPTIONS":
			return normalized;
		default:
			return "OTHER";
	}
}

export function normalizeRouteTemplate(route: string | undefined): string {
	if (!route || route.length > 240 || !route.startsWith("/")) return "unmatched";
	return route.replace(/:[A-Za-z0-9_]+/g, ":param");
}

export function normalizeOperationName(operation: string): string {
	if (!StableName.test(operation))
		throw new Error(
			"Telemetry operation names must be stable lowercase identifiers of at most 64 characters",
		);
	return operation;
}

function statusClass(statusCode: number | undefined): StatusClass {
	if (
		statusCode === undefined ||
		!Number.isInteger(statusCode) ||
		statusCode < 100 ||
		statusCode > 599
	)
		return "unknown";
	switch (Math.floor(statusCode / 100)) {
		case 1:
			return "1xx";
		case 2:
			return "2xx";
		case 3:
			return "3xx";
		case 4:
			return "4xx";
		case 5:
			return "5xx";
		default:
			return "unknown";
	}
}

export class ObservabilityMetrics {
	readonly #requestCount: Counter;
	readonly #requestDuration: Histogram;
	readonly #activeRequests: UpDownCounter;
	readonly #workerStarted: Counter;
	readonly #workerCompleted: Counter;
	readonly #workerFailed: Counter;
	readonly #workerDuration: Histogram;
	readonly #dependencyDuration: Histogram;
	readonly #dependencyFailures: Counter;
	readonly #readinessTransitions: Counter;
	readonly #readinessCheckDuration: Histogram;
	readonly #readinessCheckFailures: Counter;
	readonly #searchOutboxDepth: ReturnType<Meter["createUpDownCounter"]>;
	readonly #searchOutboxAge: Histogram;
	#workerHeartbeatAt: number | undefined;
	#activeWorkerJobStartedAt: number | undefined;

	constructor(meter: Meter) {
		this.#requestCount = meter.createCounter("rezics.http.server.request.count");
		this.#requestDuration = meter.createHistogram("rezics.http.server.request.duration", {
			unit: "ms",
		});
		this.#activeRequests = meter.createUpDownCounter("rezics.http.server.active_requests", {
			unit: "{request}",
		});
		this.#workerStarted = meter.createCounter("rezics.worker.jobs.started", { unit: "{job}" });
		this.#workerCompleted = meter.createCounter("rezics.worker.jobs.completed", {
			unit: "{job}",
		});
		this.#workerFailed = meter.createCounter("rezics.worker.jobs.failed", { unit: "{job}" });
		this.#workerDuration = meter.createHistogram("rezics.worker.job.duration", { unit: "ms" });
		this.#dependencyDuration = meter.createHistogram("rezics.dependency.duration", {
			unit: "ms",
		});
		this.#dependencyFailures = meter.createCounter("rezics.dependency.failures", {
			unit: "{failure}",
		});
		this.#readinessTransitions = meter.createCounter("rezics.readiness.transitions", {
			unit: "{transition}",
		});
		this.#readinessCheckDuration = meter.createHistogram("rezics.readiness.check.duration", {
			unit: "ms",
		});
		this.#readinessCheckFailures = meter.createCounter("rezics.readiness.check.failures", {
			unit: "{failure}",
		});
		this.#searchOutboxDepth = meter.createUpDownCounter("rezics.search.outbox.depth", {
			unit: "{item}",
		});
		this.#searchOutboxAge = meter.createHistogram("rezics.search.outbox.oldest_age", {
			unit: "s",
		});

		meter
			.createObservableGauge("rezics.runtime.memory.rss", { unit: "By" })
			.addCallback((result) => result.observe(process.memoryUsage().rss));
		meter
			.createObservableGauge("rezics.runtime.memory.heap_used", { unit: "By" })
			.addCallback((result) => result.observe(process.memoryUsage().heapUsed));
		meter
			.createObservableGauge("rezics.runtime.uptime", { unit: "s" })
			.addCallback((result) => result.observe(process.uptime()));
		meter
			.createObservableGauge("rezics.worker.heartbeat.age", { unit: "s" })
			.addCallback((result) => {
				if (this.#workerHeartbeatAt !== undefined)
					result.observe(Math.max(0, Date.now() - this.#workerHeartbeatAt) / 1_000);
			});
		meter
			.createObservableGauge("rezics.worker.job.active_age", { unit: "s" })
			.addCallback((result) => {
				if (this.#activeWorkerJobStartedAt !== undefined)
					result.observe(
						Math.max(0, Date.now() - this.#activeWorkerJobStartedAt) / 1_000,
					);
			});
	}

	requestStarted(): void {
		this.#activeRequests.add(1);
	}

	requestFinished(
		method: string,
		route: string | undefined,
		statusCode: number | undefined,
		durationMillis: number,
	): void {
		this.#activeRequests.add(-1);
		const attributes: Attributes = {
			"http.request.method": normalizeRequestMethod(method),
			"http.route": normalizeRouteTemplate(route),
			"http.response.status_class": statusClass(statusCode),
		};
		this.#requestCount.add(1, attributes);
		this.#requestDuration.record(Math.max(0, durationMillis), attributes);
	}

	workerStarted(name: string): void {
		this.#workerStarted.add(1, { "job.name": normalizeOperationName(name) });
	}

	workerFinished(name: string, durationMillis: number, failed: boolean): void {
		const attributes = { "job.name": normalizeOperationName(name) };
		(failed ? this.#workerFailed : this.#workerCompleted).add(1, attributes);
		this.#workerDuration.record(Math.max(0, durationMillis), attributes);
	}

	workerHeartbeat(activeJobStartedAt?: number): void {
		if (
			activeJobStartedAt !== undefined &&
			(!Number.isFinite(activeJobStartedAt) || activeJobStartedAt < 0)
		)
			throw new Error("Active worker job start time must be a non-negative finite number");
		this.#workerHeartbeatAt = Date.now();
		this.#activeWorkerJobStartedAt = activeJobStartedAt;
	}

	dependencyFinished(
		dependency: DependencyName,
		operation: string,
		durationMillis: number,
		failed: boolean,
	): void {
		const attributes = {
			"dependency.name": dependency,
			"dependency.operation": normalizeOperationName(operation),
		};
		this.#dependencyDuration.record(Math.max(0, durationMillis), attributes);
		if (failed) this.#dependencyFailures.add(1, attributes);
	}

	readinessTransition(from: ReadinessState, to: ReadinessState): void {
		if (from === to) return;
		this.#readinessTransitions.add(1, { from, to });
	}

	readinessCheckFinished(
		name: string,
		state: ReadinessCheckState,
		durationMillis: number,
		failureCategory?: ReadinessFailureCategory,
	): void {
		const attributes = {
			"readiness.check.name": normalizeOperationName(name),
			"readiness.check.state": state,
		};
		this.#readinessCheckDuration.record(Math.max(0, durationMillis), attributes);
		if (failureCategory)
			this.#readinessCheckFailures.add(1, {
				...attributes,
				"readiness.failure.category": failureCategory,
			});
	}

	searchOutboxState(previousDepth: number, depth: number, oldestAgeSeconds: number): void {
		if (
			!Number.isSafeInteger(previousDepth) ||
			!Number.isSafeInteger(depth) ||
			previousDepth < 0 ||
			depth < 0
		)
			throw new Error("Search outbox depth must be a non-negative safe integer");
		this.#searchOutboxDepth.add(depth - previousDepth);
		this.#searchOutboxAge.record(Math.max(0, oldestAgeSeconds));
	}
}
