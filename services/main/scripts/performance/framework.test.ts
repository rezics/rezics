import { describe, expect, it } from "vitest";
import { assertOwnedContainer, fixtureId, parseOptions } from "./config";
import { queryCases } from "./workload";
import { coverageReport, summarizePlan } from "./report";
import { parameterLiteral } from "./sql-load";

describe("performance target isolation", () => {
	it("rejects external database arguments and unbounded generator inputs", () => {
		expect(() => parseOptions(["--database-url", "postgres://localhost/rezics"])).toThrow();
		expect(() => parseOptions(["--rows", "-1"])).toThrow();
		expect(() => parseOptions(["--rows", "3000000000"])).toThrow();
	});
	it("requires both the generated name and ownership label before teardown", () => {
		const id = "0123456789abcdef";
		expect(() =>
			assertOwnedContainer(`rezics-perf-${id}`, id, { "org.rezics.performance.run": id }),
		).not.toThrow();
		expect(() =>
			assertOwnedContainer("rezics-dev-postgres-1", id, { "org.rezics.performance.run": id }),
		).toThrow();
		expect(() => assertOwnedContainer(`rezics-perf-${id}`, id, {})).toThrow();
	});
	it("keeps graph source and target identities distinct", () => {
		expect(fixtureId(1, 7)).not.toBe(fixtureId(2, 7));
		expect(fixtureId(1, 7)).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/,
		);
	});
});

describe("relationship workload coverage", () => {
	it("covers negative, nested, correlated and unseeded branches in both parameter buckets", () => {
		const cases = queryCases(parseOptions([]));
		for (const shape of [
			"credit-none",
			"realm-none",
			"tag-none",
			"score-nested",
			"and-correlated",
			"and-disjoint",
			"or-unseeded",
			"and-hot-rare",
			"and-rare-hot",
			"not-and",
			"star-relations",
		])
			for (const bucket of ["hot", "rare"])
				expect(cases.some((item) => item.shape === shape && item.bucket === bucket)).toBe(true);
		expect(new Set(cases.map((item) => item.id)).size).toBe(cases.length);
		expect(
			cases.filter((item) => item.shape !== "text").every((item) => !item.body.state.filter),
		).toBe(true);
		expect(cases.some((item) => item.pages > 1)).toBe(true);
	});
	it("reports omitted cases instead of treating partial execution as full coverage", () => {
		expect(coverageReport(["a", "b"], ["a", "a"])).toEqual({
			planned: 2,
			executed: 1,
			missing: ["b"],
			unexpected: [],
		});
		expect(() => queryCases(parseOptions(["--case", "no-such-shape"]))).toThrow();
	});
});

describe("query cost evidence", () => {
	it("preserves array and quote bind values without substituting inside SQL literals", () => {
		expect(parameterLiteral("x'); select 1; --")).toBe("E'x''); select 1; --'");
		expect(parameterLiteral(["a", "b"])).toBe('E\'{"a","b"}\'');
		expect(parameterLiteral(null)).toBe("NULL");
	});
	it("does not double-count inclusive buffer counters and exposes repeated inner work", () => {
		const summary = summarizePlan([
			{
				"Execution Time": 20,
				Plan: {
					"Node Type": "Nested Loop",
					"Shared Hit Blocks": 100,
					Plans: [
						{
							"Node Type": "Index Scan",
							"Shared Hit Blocks": 90,
							"Plan Rows": 2,
							"Actual Rows": 40,
							"Actual Loops": 50,
							"Rows Removed by Filter": 10,
						},
					],
				},
			},
		]);
		expect(summary.sharedHits).toBe(100);
		expect(summary.operators[1]).toMatchObject({
			qError: 20,
			rowsAcrossLoops: 2000,
			removedRows: 500,
		});
		expect(() => summarizePlan([])).toThrow();
	});
});
