import { describe, expect, it } from "vitest";

import {
	apiReadinessPolicy,
	apiSchedulerHealthContract,
	workerReadinessPolicy,
	workerSchedulerHealthContract,
} from "./health-contract";

describe("scheduler health contract", () => {
	it.each([
		["api", apiSchedulerHealthContract],
		["recommendation worker", workerSchedulerHealthContract],
	] as const)("separates %s startup, liveness, and readiness semantics", (_name, contract) => {
		expect(contract.startup.deadlineMs).toBeGreaterThan(
			contract.startup.initialGraceMs +
				contract.startup.intervalMs * contract.startup.failureThreshold,
		);
		expect(contract.liveness.restartsProcess).toBe(true);
		expect(contract.readiness.restartsProcess).toBe(false);
		expect(contract.readiness.gatesDeployment).toBe(true);
		expect(contract.deploymentHealthyDeadlineMs).toBeGreaterThan(contract.startup.deadlineMs);
	});

	it("gates API traffic on readiness while keeping worker health scheduler-only", () => {
		expect(apiSchedulerHealthContract.startup.path).toBe("/api/v1/startup");
		expect(apiSchedulerHealthContract.liveness.path).toBe("/api/v1/health");
		expect(apiSchedulerHealthContract.readiness).toMatchObject({
			path: "/api/v1/ready",
			gatesTraffic: true,
		});
		expect(workerSchedulerHealthContract.startup.path).toBe("/startup");
		expect(workerSchedulerHealthContract.liveness.path).toBe("/health");
		expect(workerSchedulerHealthContract.readiness).toMatchObject({
			path: "/ready",
			gatesTraffic: false,
		});
	});

	it.each([
		[apiReadinessPolicy, apiSchedulerHealthContract],
		[workerReadinessPolicy, workerSchedulerHealthContract],
	] as const)("bounds application checks inside the scheduler timeout", (policy, scheduler) => {
		for (const check of Object.values(policy.checks))
			expect(check.timeoutMs).toBeLessThan(policy.overallTimeoutMs);
		expect(policy.overallTimeoutMs).toBeLessThan(scheduler.readiness.timeoutMs);
	});
});
