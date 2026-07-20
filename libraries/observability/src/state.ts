import type { Tracer } from "@opentelemetry/api";

import type { ResolvedObservabilityConfiguration } from "./config";
import type { StructuredLogger } from "./logger";
import type { ObservabilityMetrics } from "./metrics";

export interface ActiveObservability {
	configuration: ResolvedObservabilityConfiguration;
	logger: StructuredLogger;
	metrics: ObservabilityMetrics;
	tracer: Tracer;
}

let active: ActiveObservability | undefined;

export function setActiveObservability(value: ActiveObservability): void {
	if (active) throw new Error("@rezics/observability is already initialized in this process");
	active = value;
}

export function clearActiveObservability(value: ActiveObservability): void {
	if (active === value) active = undefined;
}

export function getActiveObservability(): ActiveObservability {
	if (!active)
		throw new Error(
			"@rezics/observability must be initialized before importing instrumented server modules",
		);
	return active;
}

export function peekActiveObservability(): ActiveObservability | undefined {
	return active;
}
