import { describe, expect, it } from "vitest";

import {
	getTokenPolicyLimitRanges,
	parseTokenPolicyLimit,
	parseTokenPolicyLimits,
	StaffTrustedTokenPolicyLimitRanges,
	StandardTokenPolicyLimitRanges,
} from "./token-policy-limits";

describe("token policy limit ranges", () => {
	it("keeps the self-service Standard ranges explicit", () => {
		expect(StandardTokenPolicyLimitRanges).toEqual({
			requestsPerMinute: { minimum: 1, maximum: 300 },
			maxConcurrentRequests: { minimum: 1, maximum: 4 },
			dailyCostUnits: { minimum: 1, maximum: 10_000 },
		});
		expect(getTokenPolicyLimitRanges("standard")).toBe(StandardTokenPolicyLimitRanges);
	});

	it("selects the elevated ranges only for Staff Trusted policies", () => {
		expect(StaffTrustedTokenPolicyLimitRanges).toEqual({
			requestsPerMinute: { minimum: 1, maximum: 5_000 },
			maxConcurrentRequests: { minimum: 1, maximum: 64 },
			dailyCostUnits: { minimum: 1, maximum: 1_000_000 },
		});
		expect(getTokenPolicyLimitRanges("staff_trusted")).toBe(StaffTrustedTokenPolicyLimitRanges);
	});

	it("keeps empty, invalid, and valid field states distinct", () => {
		const range = StandardTokenPolicyLimitRanges.requestsPerMinute;
		expect(parseTokenPolicyLimit("", range)).toEqual({ kind: "empty" });
		expect(parseTokenPolicyLimit("301", range)).toEqual({ kind: "invalid" });
		expect(parseTokenPolicyLimit("1.5", range)).toEqual({ kind: "invalid" });
		expect(parseTokenPolicyLimit("300", range)).toEqual({ kind: "valid", value: 300 });
	});

	it("proves every value before producing API-ready numbers", () => {
		expect(
			parseTokenPolicyLimits(
				{
					requestsPerMinute: "60",
					maxConcurrentRequests: "2",
					dailyCostUnits: "2000",
				},
				StandardTokenPolicyLimitRanges,
			),
		).toEqual({
			valid: true,
			values: {
				requestsPerMinute: 60,
				maxConcurrentRequests: 2,
				dailyCostUnits: 2_000,
			},
		});
		expect(
			parseTokenPolicyLimits(
				{
					requestsPerMinute: "",
					maxConcurrentRequests: "2",
					dailyCostUnits: "2000",
				},
				StandardTokenPolicyLimitRanges,
			),
		).toEqual({ valid: false });
	});
});
