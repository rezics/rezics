import { describe, expect, it, vi } from "vitest";

import type { Authorization } from "../authorization";
import type { DatabaseTransaction } from "../database";
import type { MetadataOnlyUnitKind } from "../database/schema/contract-values";
import { ensureMetadataOnlyChangeAllowed, resolveCreatedMetadataOnly } from "./metadata-only";

function transactionWithStoredValue(metadataOnly: boolean): DatabaseTransaction {
	const query = {
		select: () => query,
		from: () => query,
		where: () => query,
		limit: async () => [{ metadataOnly }],
	};
	return query as unknown as DatabaseTransaction;
}

function authorizationDouble() {
	const ensureInTransaction = vi.fn(async () => undefined);
	return {
		authorization: { unit: { ensureInTransaction } } as unknown as Authorization<string>,
		ensureInTransaction,
	};
}

describe("metadata-only mutation access", () => {
	it("derives creation defaults from ownership while preserving explicit values", () => {
		expect(resolveCreatedMetadataOnly("community_owned", undefined)).toBe(true);
		expect(resolveCreatedMetadataOnly("profile_owned", undefined)).toBe(false);
		expect(resolveCreatedMetadataOnly("community_owned", false)).toBe(false);
		expect(resolveCreatedMetadataOnly("profile_owned", true)).toBe(true);
	});

	it.each(["book", "software", "media"] satisfies readonly MetadataOnlyUnitKind[])(
		"does not require supplemental access when a %s value is repeated",
		async (kind) => {
			const tx = transactionWithStoredValue(true);
			const { authorization, ensureInTransaction } = authorizationDouble();

			await ensureMetadataOnlyChangeAllowed(tx, authorization, kind, "unit-id", true);

			expect(ensureInTransaction).not.toHaveBeenCalled();
		},
	);

	it.each(["book", "software", "media"] satisfies readonly MetadataOnlyUnitKind[])(
		"requires the supplemental permission when a %s value changes",
		async (kind) => {
			const tx = transactionWithStoredValue(true);
			const { authorization, ensureInTransaction } = authorizationDouble();

			await ensureMetadataOnlyChangeAllowed(tx, authorization, kind, "unit-id", false);

			expect(ensureInTransaction).toHaveBeenCalledWith(tx, "unit-id", "unit.metadata-only.update", [
				"unit",
			]);
		},
	);
});
