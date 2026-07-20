import { describe, expect, it, vi } from "vitest";

import {
	createReadinessEvaluator,
	HealthCheckConfigurationError,
	type HealthCheckDefinition,
} from "./model";

function evaluator(
	definitions: readonly HealthCheckDefinition[],
	options: { readonly cacheTtlMs?: number; readonly onFreshReport?: () => void } = {},
) {
	return createReadinessEvaluator(definitions, {
		overallTimeoutMs: 80,
		cacheTtlMs: options.cacheTtlMs ?? 0,
		onFreshReport: options.onFreshReport,
	});
}

function check(
	name: HealthCheckDefinition["name"],
	criticality: HealthCheckDefinition["criticality"],
	probe: HealthCheckDefinition["probe"],
	timeoutMs = 40,
): HealthCheckDefinition {
	return { name, criticality, probe, timeoutMs };
}

describe("readiness check model", () => {
	it("runs independent checks concurrently and reports every result", async () => {
		let active = 0;
		let maximumActive = 0;
		let release: () => void = () => {
			throw new Error("Gate was not initialized");
		};
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const probe = async () => {
			active += 1;
			maximumActive = Math.max(maximumActive, active);
			await gate;
			active -= 1;
			return true;
		};
		const pending = evaluator([
			check("database", "required", probe),
			check("storage", "optional", probe),
			check("recommendations", "optional", probe),
		])();
		await Promise.resolve();
		await Promise.resolve();

		expect(maximumActive).toBe(3);
		release();
		const report = await pending;
		expect(report.status).toBe("ready");
		expect(report.checks.map(({ name, state }) => ({ name, state }))).toEqual([
			{ name: "database", state: "ready" },
			{ name: "storage", state: "ready" },
			{ name: "recommendations", state: "ready" },
		]);
	});

	it.each([
		["explicit not-ready", async (): Promise<boolean> => false, "not_ready"],
		[
			"rejection",
			async (): Promise<boolean> => Promise.reject(new Error("database-secret")),
			"dependency",
		],
		["timeout", async (): Promise<boolean> => new Promise(() => undefined), "timeout"],
	] as const)("makes a required %s result unavailable", async (_label, probe, category) => {
		const report = await evaluator([check("database", "required", probe, 10)])();

		expect(report.status).toBe("unavailable");
		expect(report.checks[0]).toMatchObject({
			name: "database",
			state: "unavailable",
			failureCategory: category,
		});
		expect(JSON.stringify(report)).not.toContain("database-secret");
	});

	it.each([
		["explicit not-ready", async (): Promise<boolean> => false, "not_ready"],
		[
			"rejection",
			async (): Promise<boolean> => Promise.reject(new Error("storage-secret")),
			"dependency",
		],
		["timeout", async (): Promise<boolean> => new Promise(() => undefined), "timeout"],
	] as const)(
		"keeps the API ready for an optional %s result",
		async (_label, probe, category) => {
			const report = await evaluator([check("storage", "optional", probe, 10)])();

			expect(report.status).toBe("ready");
			expect(report.checks[0]).toMatchObject({
				name: "storage",
				state: "degraded",
				failureCategory: category,
			});
			expect(JSON.stringify(report)).not.toContain("storage-secret");
		},
	);

	it("distinguishes configuration failures internally without exposing an error", async () => {
		const report = await evaluator([
			check("database", "required", async () => {
				throw new HealthCheckConfigurationError();
			}),
		])();

		expect(report.checks[0]?.failureCategory).toBe("configuration");
		expect(report.checks[0]).not.toHaveProperty("error");
	});

	it("enforces per-check deadlines below the overall deadline", () => {
		expect(() =>
			createReadinessEvaluator([check("database", "required", async () => true, 80)], {
				overallTimeoutMs: 80,
				cacheTtlMs: 0,
			}),
		).toThrow(HealthCheckConfigurationError);
	});

	it("uses one in-flight evaluation and a short cache", async () => {
		const probe = vi.fn(async () => true);
		const onFreshReport = vi.fn();
		const evaluate = evaluator([check("database", "required", probe)], {
			cacheTtlMs: 100,
			onFreshReport,
		});

		const [first, second] = await Promise.all([evaluate(), evaluate()]);
		const cached = await evaluate();

		expect(probe).toHaveBeenCalledTimes(1);
		expect(onFreshReport).toHaveBeenCalledTimes(1);
		expect(second).toBe(first);
		expect(cached).toBe(first);
	});

	it("keeps telemetry failure outside the readiness result", async () => {
		const evaluate = evaluator([check("database", "required", async () => true)], {
			onFreshReport: () => {
				throw new Error("exporter unavailable");
			},
		});

		await expect(evaluate()).resolves.toMatchObject({ status: "ready" });
	});
});
