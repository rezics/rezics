import { describe, expect, it, vi } from "vitest";

import type { DatabaseTransaction } from "../database";
import { OfficialZoneManifest } from "./data";
import { ensureOfficialZoneFollows } from "./official-zone-follows";

const ProfileId = "019b76da-a800-7200-8000-000000000001";

describe("official Zone follows", () => {
	it("inserts missing follows without rewriting existing positions", async () => {
		const onConflictDoNothing = vi.fn(async () => undefined);
		const onConflictDoUpdate = vi.fn();
		const values = vi.fn(() => ({ onConflictDoNothing, onConflictDoUpdate }));
		const insert = vi.fn(() => ({ values }));
		const select = vi.fn(() => ({
			from: () => ({
				where: () => ({
					orderBy: () => ({
						limit: async () => [{ position: "a0" }],
					}),
				}),
			}),
		}));
		const transaction = { select, insert } as unknown as DatabaseTransaction;

		await ensureOfficialZoneFollows(transaction, [ProfileId]);

		expect(insert).toHaveBeenCalledTimes(OfficialZoneManifest.length);
		expect(onConflictDoNothing).toHaveBeenCalledTimes(OfficialZoneManifest.length);
		expect(onConflictDoUpdate).not.toHaveBeenCalled();
	});
});
