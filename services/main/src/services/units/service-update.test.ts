import { beforeEach, describe, expect, it, vi } from "vitest";

const recordUnitRevision = vi.hoisted(() => vi.fn());
const transitionUnitStatus = vi.hoisted(() => vi.fn());
const ensureUnitVariantLifecycle = vi.hoisted(() => vi.fn());

vi.mock("./history", () => ({ recordUnitRevision }));
vi.mock("./status", () => ({ transitionUnitStatus }));
vi.mock("./variant-policy", () => ({
	ensureUnitVariantLifecycle,
	isDiscoverableVariantUnit: vi.fn(),
}));

import type { DatabaseTransaction } from "../database";
import { book, unit } from "../database/schema";
import { updateUnitInTransaction } from "./service";

const UnitId = "019b0000-0000-7000-8000-000000000001";
const ActorProfileId = "019b0000-0000-7000-8000-000000000002";
const ExpectedUpdatedAt = new Date("2026-08-03T10:00:00.123Z");

function transactionDouble(input?: {
	readonly unitUpdateResult?: readonly unknown[];
	readonly currentUnitResult?: readonly unknown[];
}) {
	const updates: Array<{ readonly table: unknown; readonly values: unknown }> = [];
	const update = vi.fn((table: unknown) => ({
		set: vi.fn((values: unknown) => {
			updates.push({ table, values });
			return {
				where: vi.fn(() =>
					table === unit
						? {
								returning: vi.fn(async () =>
									Array.from(
										input?.unitUpdateResult ?? [
											{ id: UnitId, status: "draft" },
										],
									),
								),
							}
						: Promise.resolve(undefined),
				),
			};
		}),
	}));
	const limit = vi.fn(async () => Array.from(input?.currentUnitResult ?? []));
	const select = vi.fn(() => ({
		from: vi.fn(() => ({ where: vi.fn(() => ({ limit })) })),
	}));
	// This test double exposes exactly the transaction operations consumed by the mutation path.
	const transaction = { update, select } as unknown as DatabaseTransaction;
	return { transaction, updates, select, limit };
}

describe("Unit update transaction", () => {
	beforeEach(() => {
		recordUnitRevision.mockReset().mockResolvedValue({ revisionId: "revision-id" });
		transitionUnitStatus.mockReset().mockResolvedValue(undefined);
		ensureUnitVariantLifecycle.mockReset().mockResolvedValue(undefined);
	});

	it("publishes with a status-only patch without issuing an empty Book update", async () => {
		const { transaction, updates } = transactionDouble();

		await updateUnitInTransaction(transaction, "book", UnitId, ActorProfileId, true, {
			expectedUpdatedAt: ExpectedUpdatedAt,
			status: "published",
		});

		expect(updates).toHaveLength(1);
		expect(updates[0]?.table).toBe(unit);
		expect(updates[0]?.values).toEqual(
			expect.objectContaining({ updatedAt: expect.any(Date) }),
		);
		expect(transitionUnitStatus).toHaveBeenCalledWith(
			transaction,
			expect.objectContaining({
				unitId: UnitId,
				toStatus: "published",
				authorization: { kind: "interactive", statusUpdateAllowed: true },
			}),
		);
	});

	it("updates Book details without requiring a Unit lifecycle field", async () => {
		const { transaction, updates } = transactionDouble();

		await updateUnitInTransaction(transaction, "book", UnitId, ActorProfileId, false, {
			expectedUpdatedAt: ExpectedUpdatedAt,
			details: { releaseStatus: "ongoing", wordCount: 100_000 },
		});

		expect(updates.map(({ table }) => table)).toEqual([unit, book]);
		expect(updates[1]?.values).toEqual(
			expect.objectContaining({ releaseStatus: "ongoing", wordCount: 100_000 }),
		);
		expect(transitionUnitStatus).not.toHaveBeenCalled();
	});

	it("updates visibility without issuing an empty subtype update", async () => {
		const { transaction, updates } = transactionDouble();

		await updateUnitInTransaction(transaction, "book", UnitId, ActorProfileId, false, {
			expectedUpdatedAt: ExpectedUpdatedAt,
			visibility: "unlisted",
		});

		expect(updates).toHaveLength(1);
		expect(updates[0]).toEqual({
			table: unit,
			values: expect.objectContaining({
				visibility: "unlisted",
				updatedAt: expect.any(Date),
			}),
		});
	});

	it("returns the current token when optimistic concurrency fails", async () => {
		const currentUpdatedAt = new Date("2026-08-03T10:00:05.000Z");
		const { transaction } = transactionDouble({
			unitUpdateResult: [],
			currentUnitResult: [{ updatedAt: currentUpdatedAt }],
		});

		await expect(
			updateUnitInTransaction(transaction, "book", UnitId, ActorProfileId, false, {
				expectedUpdatedAt: ExpectedUpdatedAt,
				visibility: "unlisted",
			}),
		).rejects.toMatchObject({
			_tag: "UnitChanged",
			details: { updatedAt: currentUpdatedAt.toISOString() },
		});
		expect(recordUnitRevision).not.toHaveBeenCalled();
		expect(transitionUnitStatus).not.toHaveBeenCalled();
	});
});
