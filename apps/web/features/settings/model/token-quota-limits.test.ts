import { describe, expect, it } from "vitest";

import {
	getTokenQuotaLimitRanges,
	parseTokenQuotaLimit,
	parseTokenQuotaLimits,
} from "./token-quota-limits";

describe("token policy limit ranges", () => {
	const policyRanges = getTokenQuotaLimitRanges({
		requestsPerMinute: 720,
		burstCapacity: 90,
		maxConcurrentRequests: 12,
		dailyCostUnits: 75_000,
	});

	it("derives self-service ceilings from the assigned policy", () => {
		expect(policyRanges).toEqual({
			requestsPerMinute: { minimum: 1, maximum: 720 },
			burstCapacity: { minimum: 1, maximum: 90 },
			maxConcurrentRequests: { minimum: 1, maximum: 12 },
			dailyCostUnits: { minimum: 1, maximum: 75_000 },
		});
	});

	it("keeps empty, invalid, and valid field states distinct", () => {
		const range = policyRanges.requestsPerMinute;
		expect(parseTokenQuotaLimit("", range)).toEqual({ kind: "empty" });
		expect(parseTokenQuotaLimit("721", range)).toEqual({ kind: "invalid" });
		expect(parseTokenQuotaLimit("1.5", range)).toEqual({ kind: "invalid" });
		expect(parseTokenQuotaLimit("720", range)).toEqual({ kind: "valid", value: 720 });
	});

	it("proves every value before producing API-ready numbers", () => {
		expect(
			parseTokenQuotaLimits(
				{
					requestsPerMinute: "60",
					burstCapacity: "10",
					maxConcurrentRequests: "2",
					dailyCostUnits: "2000",
				},
				policyRanges,
			),
		).toEqual({
			valid: true,
			values: {
				requestsPerMinute: 60,
				burstCapacity: 10,
				maxConcurrentRequests: 2,
				dailyCostUnits: 2_000,
			},
		});
		expect(
			parseTokenQuotaLimits(
				{
					requestsPerMinute: "",
					burstCapacity: "10",
					maxConcurrentRequests: "2",
					dailyCostUnits: "2000",
				},
				policyRanges,
			),
		).toEqual({ valid: false });
	});
});
