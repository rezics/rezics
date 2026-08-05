import { beforeEach, describe, expect, it, vi } from "vitest";

const execute = vi.hoisted(() => vi.fn());
const transaction = vi.hoisted(() =>
	vi.fn(async (operation: (tx: { execute: typeof execute }) => Promise<unknown>) =>
		operation({ execute }),
	),
);

vi.mock("../database", () => ({ database: { transaction } }));

import { CountEstimateUnavailable, estimateCount } from "./estimate";

describe("approximate counts", () => {
	beforeEach(() => execute.mockReset());

	it("returns freshness and churn from an allow-listed read-only estimate", async () => {
		execute
			.mockResolvedValueOnce({ rows: [] })
			.mockResolvedValueOnce({ rows: [] })
			.mockResolvedValueOnce({
				rows: [
					{
						estimatedRows: "3000000000",
						statsAt: "2026-08-05T00:00:00.000Z",
						modsSinceAnalyze: "42",
					},
				],
			});
		await expect(estimateCount("unit-localization")).resolves.toEqual({
			kind: "estimate",
			value: 3_000_000_000,
			asOf: "2026-08-05T00:00:00.000Z",
			modifiedSinceAnalyze: 42,
		});
	});

	it("fails instead of presenting an unknown estimate as zero", async () => {
		execute
			.mockResolvedValueOnce({ rows: [] })
			.mockResolvedValueOnce({ rows: [] })
			.mockResolvedValueOnce({
				rows: [{ estimatedRows: "0", statsAt: null, modsSinceAnalyze: "0" }],
			});
		await expect(estimateCount("unit")).rejects.toBeInstanceOf(CountEstimateUnavailable);
	});
});
