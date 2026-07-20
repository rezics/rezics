import { StatusCodes } from "http-status-codes";
import { describe, expect, it, vi } from "vitest";

import {
	createWorkerHealthHandler,
	createWorkerReadinessEvaluator,
	WorkerHealthState,
} from "./worker-health";
import { workerReadinessPolicy } from "../../health-contract";

describe("recommendation worker health", () => {
	it("serves process liveness without a dependency call", async () => {
		const evaluate = vi.fn(async () => Promise.reject(new Error("must not run")));
		const handler = createWorkerHealthHandler(evaluate);

		const startup = await handler(new Request("http://localhost/startup"));
		const get = await handler(new Request("http://localhost/health"));
		const head = await handler(new Request("http://localhost/health", { method: "HEAD" }));

		expect(startup.status).toBe(StatusCodes.OK);
		expect(await startup.json()).toEqual({ status: "ok" });
		expect(get.status).toBe(StatusCodes.OK);
		expect(await get.json()).toEqual({ status: "ok" });
		expect(head.status).toBe(StatusCodes.NO_CONTENT);
		expect(await head.text()).toBe("");
		expect(evaluate).not.toHaveBeenCalled();
	});

	it("requires database connectivity and a live work loop", async () => {
		const state = new WorkerHealthState();
		state.start();
		const evaluate = createWorkerReadinessEvaluator(
			state,
			async () => true,
			() => undefined,
		);
		const handler = createWorkerHealthHandler(evaluate);

		const response = await handler(new Request("http://localhost/ready"));

		expect(response.status).toBe(StatusCodes.OK);
		expect(await response.json()).toMatchObject({
			status: "ready",
			checks: { database: { state: "ready" }, worker_loop: { state: "ready" } },
		});
	});

	it("distinguishes stopped, stale, and database-unavailable worker states", async () => {
		const stopped = new WorkerHealthState();
		stopped.start();
		stopped.stop();
		const stoppedReport = await createWorkerReadinessEvaluator(
			stopped,
			async () => true,
			() => undefined,
		)();
		const databaseUnavailable = new WorkerHealthState();
		databaseUnavailable.start();
		const databaseReport = await createWorkerReadinessEvaluator(
			databaseUnavailable,
			async () => false,
			() => undefined,
		)();
		const heartbeat = new WorkerHealthState();
		heartbeat.start();
		const now = Date.now();
		const stuckJob = new WorkerHealthState();
		stuckJob.start();
		stuckJob.startJob();
		stuckJob.heartbeat();

		expect(stoppedReport.status).toBe("unavailable");
		expect(databaseReport.status).toBe("unavailable");
		expect(heartbeat.isReady(now)).toBe(true);
		expect(heartbeat.isReady(now + workerReadinessPolicy.maxHeartbeatAgeMs + 1)).toBe(false);
		expect(stuckJob.isReady(now + workerReadinessPolicy.maxActiveJobAgeMs + 1)).toBe(false);
	});
});
