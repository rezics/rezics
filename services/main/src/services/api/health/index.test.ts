import { StatusCodes } from "http-status-codes";
import { describe, expect, it, vi } from "vitest";

import type { ApiHealthCheckName } from "../../health/api-readiness";
import type { HealthCheckState, ReadinessReport } from "../../health/model";
import { createHealthRoutes } from ".";

function report(
	status: ReadinessReport<ApiHealthCheckName>["status"],
	states: {
		readonly database: HealthCheckState;
		readonly storage?: HealthCheckState;
		readonly recommendations?: HealthCheckState;
	},
): ReadinessReport<ApiHealthCheckName> {
	return {
		status,
		checks: [
			{
				name: "database",
				criticality: "required",
				state: states.database,
				latencyMs: 4,
			},
			{
				name: "storage",
				criticality: "optional",
				state: states.storage ?? "ready",
				latencyMs: 5,
			},
			{
				name: "recommendations",
				criticality: "optional",
				state: states.recommendations ?? "ready",
				latencyMs: 6,
			},
		],
	};
}

describe("health routes", () => {
	it("keeps GET and HEAD liveness dependency-free", async () => {
		const evaluate = vi.fn(async () => Promise.reject(new Error("must not run")));
		const routes = createHealthRoutes(evaluate);

		const startup = await routes.handle(new Request("http://localhost/startup"));
		const get = await routes.handle(new Request("http://localhost/health"));
		const head = await routes.handle(
			new Request("http://localhost/health", { method: "HEAD" }),
		);

		expect(startup.status).toBe(StatusCodes.OK);
		expect(await startup.json()).toEqual({ status: "ok" });
		expect(get.status).toBe(StatusCodes.OK);
		expect(await get.json()).toEqual({ status: "ok" });
		expect(head.status).toBe(StatusCodes.NO_CONTENT);
		expect(await head.text()).toBe("");
		expect(evaluate).not.toHaveBeenCalled();
	});

	it("returns 200 with stable degraded optional checks", async () => {
		const routes = createHealthRoutes(async () =>
			report("ready", { database: "ready", recommendations: "degraded" }),
		);

		const response = await routes.handle(new Request("http://localhost/ready"));

		expect(response.status).toBe(StatusCodes.OK);
		expect(await response.json()).toEqual({
			status: "ready",
			checks: {
				database: { state: "ready", latencyMs: 4 },
				storage: { state: "ready", latencyMs: 5 },
				recommendations: { state: "degraded", latencyMs: 6 },
			},
		});
	});

	it("recovers from 503 to 200 without replacing the process", async () => {
		const unavailableReport = report("unavailable", { database: "unavailable" });
		const readyReport = report("ready", { database: "ready" });
		let index = 0;
		const routes = createHealthRoutes(async () => {
			index += 1;
			return index === 1 ? unavailableReport : readyReport;
		});

		const unavailable = await routes.handle(new Request("http://localhost/ready"));
		const ready = await routes.handle(new Request("http://localhost/ready"));

		expect(unavailable.status).toBe(StatusCodes.SERVICE_UNAVAILABLE);
		expect(ready.status).toBe(StatusCodes.OK);
		expect(JSON.stringify(await unavailable.json())).not.toContain("error");
	});
});
