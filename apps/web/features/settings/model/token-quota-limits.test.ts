import { describe, expect, it } from "vitest";

import {
	getTokenQuotaLimitRanges,
	parseTokenQuotaLimit,
	parseTokenQuotaLimits,
	PrivilegedTokenQuotaLimitRanges,
	StandardTokenQuotaLimitRanges,
} from "./token-quota-limits";

describe("token policy limit ranges", () => {
	it("keeps the self-service Standard ranges explicit", () => {
		expect(StandardTokenQuotaLimitRanges).toEqual({
			requestsPerMinute: { minimum: 1, maximum: 300 },
			burstCapacity: { minimum: 1, maximum: 300 },
			maxConcurrentRequests: { minimum: 1, maximum: 4 },
			dailyCostUnits: { minimum: 1, maximum: 10_000 },
		});
		expect(getTokenQuotaLimitRanges("standard")).toBe(StandardTokenQuotaLimitRanges);
	});

	it("selects the elevated ranges only for Privileged policies", () => {
		expect(PrivilegedTokenQuotaLimitRanges).toEqual({
			requestsPerMinute: { minimum: 1, maximum: 5_000 },
			burstCapacity: { minimum: 1, maximum: 5_000 },
			maxConcurrentRequests: { minimum: 1, maximum: 64 },
			dailyCostUnits: { minimum: 1, maximum: 1_000_000 },
		});
		expect(getTokenQuotaLimitRanges("privileged")).toBe(PrivilegedTokenQuotaLimitRanges);
	});

	it("keeps empty, invalid, and valid field states distinct", () => {
		const range = StandardTokenQuotaLimitRanges.requestsPerMinute;
		expect(parseTokenQuotaLimit("", range)).toEqual({ kind: "empty" });
		expect(parseTokenQuotaLimit("301", range)).toEqual({ kind: "invalid" });
		expect(parseTokenQuotaLimit("1.5", range)).toEqual({ kind: "invalid" });
		expect(parseTokenQuotaLimit("300", range)).toEqual({ kind: "valid", value: 300 });
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
				StandardTokenQuotaLimitRanges,
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
				StandardTokenQuotaLimitRanges,
			),
		).toEqual({ valid: false });
	});
});
