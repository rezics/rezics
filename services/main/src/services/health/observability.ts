import { getActiveObservability, type ReadinessState } from "@rezics/observability";

import type { HealthCheckName, ReadinessReport, ReadinessStatus } from "./model";

function telemetryState(status: ReadinessStatus): ReadinessState {
	return status === "ready" ? "ready" : "not_ready";
}

export function createReadinessObserver(processName: "api" | "recommendation-worker") {
	let previous: ReadinessStatus | undefined;
	return (report: ReadinessReport<HealthCheckName>): void => {
		const observability = getActiveObservability();
		for (const check of report.checks)
			observability.metrics.readinessCheckFinished(
				check.name,
				check.state,
				check.latencyMs,
				check.failureCategory,
			);
		if (previous && previous !== report.status) {
			observability.metrics.readinessTransition(
				telemetryState(previous),
				telemetryState(report.status),
			);
			const details = {
				eventName: "readiness.state.changed",
				attributes: {
					process: processName,
					from: previous,
					to: report.status,
					checks: report.checks.map((check) => ({
						name: check.name,
						state: check.state,
						failureCategory: check.failureCategory,
					})),
				},
			} as const;
			if (report.status === "ready") observability.logger.info("Readiness recovered", details);
			else observability.logger.warn("Readiness lost", details);
		}
		previous = report.status;
	};
}
