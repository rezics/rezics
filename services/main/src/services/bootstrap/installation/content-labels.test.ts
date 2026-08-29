import { beforeEach, describe, expect, it, vi } from "vitest";

const ensureBootstrapAddressedUnit = vi.hoisted(() => vi.fn());
const ensureOwnership = vi.hoisted(() => vi.fn());
const insertStarterLocalization = vi.hoisted(() => vi.fn());
const recordUnitRevision = vi.hoisted(() => vi.fn());
const ensureSimpleTagExpressionInTransaction = vi.hoisted(() => vi.fn());

vi.mock("./common", async (importOriginal) => ({
	...(await importOriginal<typeof import("./common")>()),
	ensureBootstrapAddressedUnit,
	ensureOwnership,
	insertStarterLocalization,
}));
vi.mock("../../units/history", () => ({ recordUnitRevision }));
vi.mock("../../tag-expressions/service", () => ({ ensureSimpleTagExpressionInTransaction }));

import type { DatabaseTransaction } from "../../database";
import { ContentLabelRegistryManifest } from "../data";
import { ensureContentLabelRegistry } from "./content-labels";

function transactionWithTagReads(rows: readonly (readonly Record<string, unknown>[])[]) {
	let readIndex = 0;
	const limit = vi.fn(async () => rows[readIndex++] ?? []);
	const where = vi.fn(() => ({ limit }));
	const from = vi.fn(() => ({ where }));
	const select = vi.fn(() => ({ from }));
	const onConflictDoNothing = vi.fn(async () => undefined);
	const values = vi.fn(() => ({ onConflictDoNothing }));
	const insert = vi.fn(() => ({ values }));
	return {
		transaction: { select, insert } as unknown as DatabaseTransaction,
		insert,
	};
}

describe("content-label bootstrap installation", () => {
	beforeEach(() => {
		ensureBootstrapAddressedUnit.mockReset();
		ensureOwnership.mockReset();
		insertStarterLocalization.mockReset();
		recordUnitRevision.mockReset();
		ensureSimpleTagExpressionInTransaction.mockReset();
		ensureSimpleTagExpressionInTransaction.mockResolvedValue({
			expressionId: "019c0000-0000-7000-8000-000000000001",
			created: false,
		});
	});

	it("writes starter state and one create revision only for newly reserved Tags", async () => {
		ensureBootstrapAddressedUnit.mockResolvedValue(true);
		const { transaction, insert } = transactionWithTagReads(
			ContentLabelRegistryManifest.map(() => []),
		);

		await ensureContentLabelRegistry(transaction);

		expect(insert).toHaveBeenCalledTimes(ContentLabelRegistryManifest.length * 2);
		expect(ensureSimpleTagExpressionInTransaction).toHaveBeenCalledTimes(
			ContentLabelRegistryManifest.length,
		);
		expect(ensureOwnership).toHaveBeenCalledTimes(ContentLabelRegistryManifest.length);
		expect(insertStarterLocalization).toHaveBeenCalledTimes(
			ContentLabelRegistryManifest.reduce(
				(total, { localizations }) => total + localizations.length,
				0,
			),
		);
		expect(recordUnitRevision).toHaveBeenCalledTimes(ContentLabelRegistryManifest.length);
	});

	it("does not add starter copy or history to existing reserved Tags", async () => {
		ensureBootstrapAddressedUnit.mockResolvedValue(false);
		const { transaction, insert } = transactionWithTagReads(
			ContentLabelRegistryManifest.map((label) => [
				{ id: label.id, directlyApplicable: false, defaultSpoilerLevel: null },
			]),
		);

		await ensureContentLabelRegistry(transaction);

		expect(insert).not.toHaveBeenCalled();
		expect(ensureSimpleTagExpressionInTransaction).toHaveBeenCalledTimes(
			ContentLabelRegistryManifest.length,
		);
		expect(ensureOwnership).toHaveBeenCalledTimes(ContentLabelRegistryManifest.length);
		expect(insertStarterLocalization).not.toHaveBeenCalled();
		expect(recordUnitRevision).not.toHaveBeenCalled();
	});

	it("rejects policy drift on an existing registry Tag", async () => {
		ensureBootstrapAddressedUnit.mockResolvedValue(false);
		const first = ContentLabelRegistryManifest[0];
		const { transaction } = transactionWithTagReads([
			[{ id: first.id, directlyApplicable: false, defaultSpoilerLevel: 1 }],
		]);

		await expect(ensureContentLabelRegistry(transaction)).rejects.toThrow(
			/unexpected defaultSpoilerLevel/,
		);
		expect(ensureOwnership).not.toHaveBeenCalled();
	});
});
