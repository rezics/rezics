import { beforeEach, describe, expect, it, vi } from "vitest";

const insertUnit = vi.hoisted(() => vi.fn());

vi.mock("../../units/create", () => ({ insertUnit }));

import type { DatabaseTransaction } from "../../database";
import { ensureBootstrapAddressedUnit, insertStarterLocalization } from "./common";

const UnitId = "019b76da-a800-7200-8000-000000000010";
const ScopeId = "019b76da-a800-7200-8000-000000000011";

function transactionWithReads(
	unitRows: readonly Record<string, unknown>[],
	addressRows: readonly Record<string, unknown>[],
) {
	let selectCount = 0;
	const select = vi.fn(() => {
		selectCount += 1;
		const rows = selectCount === 1 ? unitRows : addressRows;
		return {
			from: () => ({
				where: () => ({
					limit: async () => rows,
				}),
			}),
		};
	});
	const values = vi.fn(async () => undefined);
	const insert = vi.fn(() => ({ values }));
	const update = vi.fn();
	const transaction = { select, insert, update } as unknown as DatabaseTransaction;
	return { transaction, insert, values, update };
}

describe("bootstrap identity primitives", () => {
	beforeEach(() => {
		insertUnit.mockReset();
	});

	it("creates a missing reserved Unit and writes its first canonical address", async () => {
		const { transaction, insert, update } = transactionWithReads([], []);
		insertUnit.mockResolvedValue({ id: UnitId });

		await expect(
			ensureBootstrapAddressedUnit(transaction, {
				id: UnitId,
				kind: "zone",
				scopeUnitId: ScopeId,
				slug: "explore",
			}),
		).resolves.toBe(true);
		expect(insertUnit).toHaveBeenCalledWith(
			transaction,
			expect.objectContaining({ id: UnitId, kind: "zone" }),
		);
		expect(insert).toHaveBeenCalled();
		expect(update).not.toHaveBeenCalled();
	});

	it("leaves an existing reserved Unit and its address untouched", async () => {
		const { transaction, insert, update } = transactionWithReads(
			[{ id: UnitId, kind: "zone" }],
			[{ id: "address-id" }],
		);

		await expect(
			ensureBootstrapAddressedUnit(transaction, {
				id: UnitId,
				kind: "zone",
				scopeUnitId: ScopeId,
				slug: "renamed",
			}),
		).resolves.toBe(false);
		expect(insertUnit).not.toHaveBeenCalled();
		expect(insert).not.toHaveBeenCalled();
		expect(update).not.toHaveBeenCalled();
	});

	it("inserts starter localization without updating existing copy", async () => {
		const onConflictDoNothing = vi.fn(async () => undefined);
		const values = vi.fn(() => ({ onConflictDoNothing }));
		const insert = vi.fn(() => ({ values }));
		const update = vi.fn();
		const transaction = { insert, update } as unknown as DatabaseTransaction;

		await insertStarterLocalization(transaction, {
			unitId: UnitId,
			language: "en",
			position: "a0",
			title: "Starter",
		});

		expect(insert).toHaveBeenCalled();
		expect(update).not.toHaveBeenCalled();
		expect(onConflictDoNothing).toHaveBeenCalled();
	});
});
