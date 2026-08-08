import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { WorkPolicy } from "../performance/policy";

describe("recommendation refresh work bounds", () => {
	it("keeps sparse best refresh independent from catalogue size", async () => {
		const source = await readFile(new URL("./worker.ts", import.meta.url), "utf8");

		expect(WorkPolicy.recommendation.maxOnlineCandidates).toBe(256);
		expect(WorkPolicy.recommendation.minimumRefreshIntervalMs).toBe(3_600_000);
		expect(source).toContain("signal.weight > 0");
		expect(source).toContain("RecommendationPolicy.bestWindowDays");
		expect(source).not.toContain("FROM unit_identity");
		expect(source).not.toContain("buildUnitEdges");
	});

	it("materializes one best score at an immutable snapshot watermark", async () => {
		const source = await readFile(new URL("./worker.ts", import.meta.url), "utf8");

		expect(source).toContain("const sourceWatermark = new Date()");
		expect(source).toContain("snapshot_id, unit_id, unit_kind, score, unit_updated_at");
		expect(source).toContain("RecommendationPolicy.bestHalfLifeHours");
		expect(source).not.toContain("hot_score");
		expect(source).not.toContain("rising_score");
	});
});
