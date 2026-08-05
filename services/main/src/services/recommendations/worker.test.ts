import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { WorkPolicy } from "../performance/policy";

describe("recommendation refresh work bounds", () => {
	it("keeps structural work source-batched and removes global pair and two-hop expansion", async () => {
		const source = await readFile(new URL("./worker.ts", import.meta.url), "utf8");

		expect(WorkPolicy.recommendation.maxStructuralSignals).toBe(32);
		expect(WorkPolicy.recommendation.maxStructuralDegree).toBe(256);
		expect(WorkPolicy.recommendation.maxRawStructuralPeers).toBe(8_192);
		expect(WorkPolicy.recommendation.maxRefreshBatchUnits).toBe(500);
		expect(source).toContain("WHERE signal_rank <=");
		expect(source).toContain("LIMIT ${RecommendationPolicy.maxStructuralDegree + 1}");
		expect(source).toContain(".limit(WorkPolicy.recommendation.maxRefreshBatchUnits)");
		expect(source).not.toMatch(/JOIN unit_tag b ON b\.tag_id = a\.tag_id/);
		expect(source).not.toMatch(/JOIN probability second/);
		expect(source).not.toContain(["touch", "search", "unit", "projection"].join("_"));
	});
});
