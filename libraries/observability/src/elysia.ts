import {
	context as otelContext,
	propagation,
	SpanKind,
	SpanStatusCode,
	trace,
	type Span,
	type TextMapGetter,
} from "@opentelemetry/api";
import Elysia, { StatusMap } from "elysia";

import { normalizeRequestMethod, normalizeRouteTemplate } from "./metrics";
import { getActiveObservability } from "./state";

export interface ElysiaObservabilityOptions {
	excludedPaths?: readonly string[];
}

interface RequestTelemetry {
	span: Span;
	method: string;
	startedAt: number;
	route?: string;
	finished: boolean;
}

const headerGetter: TextMapGetter<Headers> = {
	get(carrier, key) {
		return carrier.get(key) ?? undefined;
	},
	keys(carrier) {
		return Array.from(carrier.keys());
	},
};

function numericStatus(status: unknown): number | undefined {
	if (typeof status === "number") return Number.isInteger(status) ? status : undefined;
	if (typeof status !== "string") return undefined;
	return Object.entries(StatusMap).find(([name]) => name === status)?.[1];
}

export function createElysiaObservability(options: ElysiaObservabilityOptions = {}): Elysia {
	const observability = getActiveObservability();
	const requests = new WeakMap<Request, RequestTelemetry>();
	const excludedPaths = new Set(options.excludedPaths ?? ["/api/health"]);

	function finish(request: Request, statusCode: number | undefined): void {
		const telemetry = requests.get(request);
		if (!telemetry || telemetry.finished) return;
		telemetry.finished = true;
		requests.delete(request);
		const route = normalizeRouteTemplate(telemetry.route);
		telemetry.span.updateName(`${normalizeRequestMethod(telemetry.method)} ${route}`);
		telemetry.span.setAttributes({
			"http.request.method": normalizeRequestMethod(telemetry.method),
			"http.route": route,
			...(statusCode === undefined ? {} : { "http.response.status_code": statusCode }),
		});
		if (statusCode !== undefined && statusCode >= 500)
			telemetry.span.setStatus({ code: SpanStatusCode.ERROR });
		observability.metrics.requestFinished(
			telemetry.method,
			telemetry.route,
			statusCode,
			performance.now() - telemetry.startedAt,
		);
		telemetry.span.end();
	}

	return new Elysia({ name: "@rezics/observability/elysia" })
		.wrap((handler, request) => {
			if (
				observability.configuration.disabled ||
				!observability.configuration.features.http ||
				excludedPaths.has(new URL(request.url).pathname)
			)
				return handler;
			const parent = propagation.extract(otelContext.active(), request.headers, headerGetter);
			const method = normalizeRequestMethod(request.method);
			const span = observability.tracer.startSpan(
				`${method} unmatched`,
				{
					kind: SpanKind.SERVER,
					attributes: { "http.request.method": method },
				},
				parent,
			);
			requests.set(request, {
				span,
				method,
				startedAt: performance.now(),
				finished: false,
			});
			observability.metrics.requestStarted();
			request.signal.addEventListener("abort", () => finish(request, 499), { once: true });
			const activeContext = trace.setSpan(parent, span);
			return (...arguments_: unknown[]) =>
				otelContext.with(activeContext, handler, undefined, ...arguments_);
		})
		.onTransform({ as: "global" }, ({ request, route }) => {
			const telemetry = requests.get(request);
			if (!telemetry) return;
			telemetry.route = route;
		})
		.onAfterResponse({ as: "global" }, ({ request, set }) => {
			finish(request, numericStatus(set.status) ?? 200);
		});
}
