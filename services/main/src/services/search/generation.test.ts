import { beforeEach, describe, expect, it, vi } from "vitest";

const limit = vi.hoisted(() => vi.fn());

vi.mock("../database", () => ({
	database: {
		select: vi.fn(() => ({
			from: vi.fn(() => ({
				where: vi.fn(() => ({ limit })),
			})),
		})),
	},
}));

import { SearchUnavailable } from "./errors";
import { clearActiveSearchGenerationCache, getActiveSearchGeneration } from "./generation";
import { getSearchSettingsFingerprint } from "./settings";

const currentGeneration = {
	id: "019f8293-faf7-7521-98d5-9cd4ea6c77f5",
	indexUid: "rezics_units_v4_20260723",
	projectionVersion: 4,
	settingsFingerprint: getSearchSettingsFingerprint("current"),
} as const;

describe("active search generation compatibility", () => {
	beforeEach(() => {
		clearActiveSearchGenerationCache();
		limit.mockReset();
	});

	it("accepts the current projection version and settings fingerprint", async () => {
		limit.mockResolvedValue([currentGeneration]);

		await expect(getActiveSearchGeneration("current")).resolves.toEqual({
			...currentGeneration,
			kind: "current",
		});
	});

	it("rejects a stale projection version even when the settings fingerprint matches", async () => {
		limit.mockResolvedValue([{ ...currentGeneration, projectionVersion: 1 }]);

		const error = await getActiveSearchGeneration("current").catch((cause: unknown) => cause);
		expect(error).toBeInstanceOf(SearchUnavailable);
		expect((error as SearchUnavailable).cause).toEqual(
			new Error("Active current search generation contract does not match this application"),
		);
	});

	it("rejects a stale settings fingerprint", async () => {
		limit.mockResolvedValue([{ ...currentGeneration, settingsFingerprint: "a".repeat(64) }]);

		await expect(getActiveSearchGeneration("current")).rejects.toBeInstanceOf(
			SearchUnavailable,
		);
	});
});
