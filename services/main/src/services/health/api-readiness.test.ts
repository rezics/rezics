import { describe, expect, it } from "vitest";

import { apiReadinessPolicy } from "../../health-contract";
import { apiReadinessDefinitions, createApiReadinessEvaluator } from "./api-readiness";

const readyDependencies = {
	database: async () => true,
	storage: async () => true,
	recommendations: async () => true,
	search: async () => true,
};

describe("API readiness policy", () => {
	it("encodes dependency criticality as the single policy source", () => {
		expect(apiReadinessPolicy.checks).toEqual({
			database: { criticality: "required", timeoutMs: 1_000 },
			storage: { criticality: "optional", timeoutMs: 1_500 },
			recommendations: { criticality: "optional", timeoutMs: 1_500 },
			search: { criticality: "optional", timeoutMs: 1_500 },
		});
		expect(
			apiReadinessDefinitions(readyDependencies).map(({ name, criticality }) => ({
				name,
				criticality,
			})),
		).toEqual([
			{ name: "database", criticality: "required" },
			{ name: "storage", criticality: "optional" },
			{ name: "recommendations", criticality: "optional" },
			{ name: "search", criticality: "optional" },
		]);
	});

	it("consumes a fulfilled recommendation ready=false result as degraded", async () => {
		const evaluate = createApiReadinessEvaluator(
			{ ...readyDependencies, recommendations: async () => false },
			() => undefined,
		);

		const report = await evaluate();

		expect(report.status).toBe("ready");
		expect(report.checks.find((check) => check.name === "recommendations")).toMatchObject({
			state: "degraded",
			failureCategory: "not_ready",
		});
	});

	it("withholds traffic for an explicit database not-ready result", async () => {
		const evaluate = createApiReadinessEvaluator(
			{ ...readyDependencies, database: async () => false },
			() => undefined,
		);

		expect((await evaluate()).status).toBe("unavailable");
	});
});
