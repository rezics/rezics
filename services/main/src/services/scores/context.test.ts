import { beforeEach, describe, expect, it, vi } from "vitest";

const realmLimit = vi.hoisted(() => vi.fn());
const databaseSelect = vi.hoisted(() => vi.fn());

vi.mock("../database", () => ({
	database: {
		select: databaseSelect,
	},
}));

import { ScoreContextUnitUnsupported } from "./errors";
import { ensureScoreContextParticipation, resolveScoreContext } from "./context";

const ContextUnitId = "019b76da-a800-7300-8000-000000000002";

describe("Score context resolution", () => {
	const ensureCanRead = vi.fn(async () => undefined);
	const ensureParticipation = vi.fn(async () => undefined);

	beforeEach(() => {
		realmLimit.mockReset();
		databaseSelect.mockReset();
		databaseSelect.mockImplementation(() => ({
			from: vi.fn(() => ({
				where: vi.fn(() => ({ limit: realmLimit })),
			})),
		}));
		ensureCanRead.mockClear();
		ensureParticipation.mockClear();
	});

	it("resolves a readable Realm Unit as a supported Score context", async () => {
		realmLimit.mockResolvedValue([{ id: ContextUnitId }]);

		await expect(
			resolveScoreContext({ unit: { ensureCanRead } }, ContextUnitId),
		).resolves.toEqual({
			contextUnitId: ContextUnitId,
			kind: "realm",
		});
		expect(ensureCanRead).toHaveBeenCalledWith(ContextUnitId);
	});

	it("rejects a readable Unit that is not a Realm", async () => {
		realmLimit.mockResolvedValue([]);

		await expect(
			resolveScoreContext({ unit: { ensureCanRead } }, ContextUnitId),
		).rejects.toBeInstanceOf(ScoreContextUnitUnsupported);
	});

	it("requires Realm participation before returning a writable context", async () => {
		realmLimit.mockResolvedValue([{ id: ContextUnitId }]);

		await expect(
			ensureScoreContextParticipation(
				{ unit: { ensureCanRead }, realm: { ensureParticipation } },
				ContextUnitId,
			),
		).resolves.toEqual({
			contextUnitId: ContextUnitId,
			kind: "realm",
		});
		expect(ensureParticipation).toHaveBeenCalledWith(ContextUnitId);
	});
});
