import { describe, expect, it } from "vitest";

import { createRecommendationTracking, verifyRecommendationTracking } from "./tracking";

const targetUnitId = "00000000-0000-7000-8000-000000000001";
const fields = {
	requestId: "00000000-0000-7000-8000-000000000002",
	surface: "home_feed",
	position: 3,
	policyVersion: "hybrid_v1",
};

describe("recommendation tracking signatures", () => {
	it("accepts the exact tracking fields issued for a recommendation", () => {
		const tracking = createRecommendationTracking(targetUnitId, fields);

		expect(verifyRecommendationTracking(targetUnitId, tracking)).toBe(true);
		expect(tracking.signature).toMatch(/^[A-Za-z0-9_-]{43}$/);
	});

	it.each([
		["target", "00000000-0000-7000-8000-000000000099", fields],
		["request", targetUnitId, { ...fields, requestId: crypto.randomUUID() }],
		["surface", targetUnitId, { ...fields, surface: "post_related" }],
		["position", targetUnitId, { ...fields, position: 4 }],
		["policy", targetUnitId, { ...fields, policyVersion: "hybrid_v2" }],
	] as const)("rejects a changed %s", (_name, target, changedFields) => {
		const tracking = createRecommendationTracking(targetUnitId, fields);

		expect(
			verifyRecommendationTracking(target, {
				...changedFields,
				signature: tracking.signature,
			}),
		).toBe(false);
	});
});
