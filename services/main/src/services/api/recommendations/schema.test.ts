import { Check } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import { RecommendationTrackingSchema } from "./schema";

const tracking = {
	requestId: "00000000-0000-7000-8000-000000000001",
	surface: "home_feed",
	position: 0,
	policyVersion: "hybrid_v1",
	signature: "a".repeat(43),
};

describe("recommendation tracking schema", () => {
	it("requires a nonblank policy version and a canonical signature", () => {
		expect(Check(RecommendationTrackingSchema, tracking)).toBe(true);
		expect(Check(RecommendationTrackingSchema, { ...tracking, policyVersion: "   " })).toBe(
			false,
		);
		expect(Check(RecommendationTrackingSchema, { ...tracking, signature: "not-base64" })).toBe(
			false,
		);
	});
});
