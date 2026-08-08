import { describe, expect, it } from "vitest";

import { requirePolicyBound, WorkPolicy } from "./policy";

describe("bounded-work policy", () => {
	it("keeps recommendation work independent from catalogue size", () => {
		expect(WorkPolicy.recommendation.minimumRefreshIntervalMs).toBe(3_600_000);
		expect(WorkPolicy.recommendation.maxOnlineCandidates).toBe(256);
		expect(WorkPolicy.recommendation.maxRelationCandidates).toBeLessThanOrEqual(
			WorkPolicy.recommendation.maxOnlineCandidates,
		);
	});

	it("keeps batch localization hydration below B * L_max", () => {
		expect(
			WorkPolicy.localization.maxBatchUnits * WorkPolicy.localization.maxLanguagesPerUnit,
		).toBe(3_500);
	});

	it("rejects configuration outside a policy ceiling", () => {
		expect(requirePolicyBound("batch", 100, 500)).toBe(100);
		expect(() => requirePolicyBound("batch", 501, 500)).toThrow(RangeError);
		expect(() => requirePolicyBound("batch", 1.5, 500)).toThrow(RangeError);
	});
});
