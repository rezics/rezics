import { describe, expect, it } from "vitest";

import { requirePolicyBound, WorkPolicy } from "./policy";

describe("bounded-work policy", () => {
	it("keeps the structural peer proof equal to S * D", () => {
		expect(WorkPolicy.recommendation.maxRawStructuralPeers).toBe(
			WorkPolicy.recommendation.maxStructuralSignals *
				WorkPolicy.recommendation.maxStructuralDegree,
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
