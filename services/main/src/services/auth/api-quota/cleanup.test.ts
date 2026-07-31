import { describe, expect, it } from "vitest";

import {
	ApiQuotaDailyUsageRetentionDays,
	ApiQuotaRateStateRetentionMilliseconds,
	apiQuotaCleanupCutoffs,
} from "./cleanup";

describe("API quota state cleanup", () => {
	it("keeps enough rate history for the slowest valid bucket refill", () => {
		expect(ApiQuotaRateStateRetentionMilliseconds).toBeGreaterThan(5_000 * 60 * 1_000);
	});

	it("uses UTC dates for daily usage retention", () => {
		const now = new Date("2026-07-31T23:59:59.000Z");
		expect(apiQuotaCleanupCutoffs(now)).toEqual({
			rateState: new Date(now.getTime() - ApiQuotaRateStateRetentionMilliseconds),
			dailyUsage: "2026-06-26",
		});
		expect(ApiQuotaDailyUsageRetentionDays).toBe(35);
	});
});
