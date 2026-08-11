import { describe, expect, it } from "vitest";

import { UnitMergeOperationPhaseValues } from "../../database/schema";
import {
	UnitMergePolicyV1,
	nextUnitMergePhase,
	unitMergeRequestExpiry,
	unitMergeRetryDelayMilliseconds,
} from "./policy";

describe("centralized Unit merge policy", () => {
	it("requires four independent approvals with one-vote veto and no self-review", () => {
		expect(UnitMergePolicyV1).toMatchObject({
			requiredApprovals: 4,
			vetoEnabled: true,
			selfReviewForbidden: true,
			manifestVersion: 1,
		});
	});

	it("expires reviewed requests after seven days", () => {
		const now = new Date("2026-08-11T00:00:00.000Z");
		expect(unitMergeRequestExpiry(now).toISOString()).toBe("2026-08-18T00:00:00.000Z");
	});

	it("walks every durable phase exactly once", () => {
		for (const [index, phase] of UnitMergeOperationPhaseValues.entries())
			expect(nextUnitMergePhase(phase)).toBe(UnitMergeOperationPhaseValues[index + 1] ?? null);
	});

	it("bounds exponential retry delay and jitter", () => {
		expect(unitMergeRetryDelayMilliseconds(1, 0)).toBe(2_000);
		expect(unitMergeRetryDelayMilliseconds(2, 0.5)).toBe(4_500);
		expect(unitMergeRetryDelayMilliseconds(99, 1)).toBe(600_999);
	});
});
