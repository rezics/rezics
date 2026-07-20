import { getActiveObservability } from "@rezics/observability";
import { describe, expect, it, vi } from "vitest";

import type { ReadinessReport } from "./model";
import { createReadinessObserver } from "./observability";

function report(status: ReadinessReport["status"]): ReadinessReport {
	return {
		status,
		checks: [
			{
				name: "database",
				criticality: "required",
				state: status === "ready" ? "ready" : "unavailable",
				latencyMs: 7,
				...(status === "ready" ? {} : { failureCategory: "timeout" as const }),
			},
		],
	};
}

describe("readiness observability", () => {
	it("records bounded check metrics and emits logs only on state changes", () => {
		const observability = getActiveObservability();
		const checkFinished = vi.spyOn(observability.metrics, "readinessCheckFinished");
		const transition = vi.spyOn(observability.metrics, "readinessTransition");
		const info = vi.spyOn(observability.logger, "info").mockImplementation(() => undefined);
		const warn = vi.spyOn(observability.logger, "warn").mockImplementation(() => undefined);
		const observe = createReadinessObserver("api");

		observe(report("ready"));
		observe(report("ready"));
		observe(report("unavailable"));
		observe(report("unavailable"));
		observe(report("ready"));

		expect(checkFinished).toHaveBeenCalledTimes(5);
		expect(checkFinished).toHaveBeenCalledWith("database", "unavailable", 7, "timeout");
		expect(transition.mock.calls).toEqual([
			["ready", "not_ready"],
			["not_ready", "ready"],
		]);
		expect(warn).toHaveBeenCalledTimes(1);
		expect(info).toHaveBeenCalledTimes(1);
	});
});
