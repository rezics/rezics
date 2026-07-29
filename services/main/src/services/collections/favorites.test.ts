import { beforeEach, describe, expect, it, vi } from "vitest";

const insertUnit = vi.hoisted(() => vi.fn());
const recordUnitRevision = vi.hoisted(() => vi.fn());
const createCollectionStructureHistory = vi.hoisted(() => vi.fn());

vi.mock("../database", () => ({
	database: { transaction: vi.fn() },
}));
vi.mock("../units/create", () => ({ insertUnit }));
vi.mock("../units/history", () => ({ recordUnitRevision }));
vi.mock("../collection-structure/history", () => ({ createCollectionStructureHistory }));

import type { DatabaseTransaction } from "../database";
import { ensureFixedFavoritesInTransaction } from "./favorites";

const ProfileId = "019b76da-a800-7200-8000-000000000001";
const CollectionId = "019b76da-a800-7250-8000-000000000001";
const BootstrapEpoch = new Date("2026-01-01T00:00:00.000Z");

function transactionWithExistingFavorites(existingId?: string) {
	const limit = vi.fn(async () => (existingId ? [{ id: existingId }] : []));
	const where = vi.fn(() => ({ limit }));
	const from = vi.fn(() => ({ where }));
	const select = vi.fn(() => ({ from }));
	const values = vi.fn(async (_value: unknown) => undefined);
	const insert = vi.fn(() => ({ values }));
	const transaction = { select, insert } as unknown as DatabaseTransaction;
	return { transaction, insert, values };
}

describe("Favorites identity provisioning", () => {
	beforeEach(() => {
		insertUnit.mockReset();
		recordUnitRevision.mockReset();
		createCollectionStructureHistory.mockReset();
	});

	it("creates a fixed Favorites Collection with its reserved Unit identity and epoch", async () => {
		const { transaction, values } = transactionWithExistingFavorites();
		insertUnit.mockResolvedValue({ id: CollectionId });
		recordUnitRevision.mockResolvedValue({ revisionId: "revision-id" });
		createCollectionStructureHistory.mockResolvedValue({
			revisionId: "items-revision-id",
		});

		await ensureFixedFavoritesInTransaction(transaction, {
			profileId: ProfileId,
			collectionId: CollectionId,
			createdAt: BootstrapEpoch,
		});

		expect(insertUnit).toHaveBeenCalledWith(transaction, {
			id: CollectionId,
			kind: "collection",
			status: "published",
			visibility: "private",
			publishedAt: BootstrapEpoch,
			createdAt: BootstrapEpoch,
			updatedAt: BootstrapEpoch,
			statusActor: { kind: "profile", profileId: ProfileId },
		});
		expect(values.mock.calls.map(([value]) => value)).toEqual(
			expect.arrayContaining([
				{
					profileId: ProfileId,
					collectionId: CollectionId,
					createdAt: BootstrapEpoch,
				},
			]),
		);
		expect(createCollectionStructureHistory).toHaveBeenCalledWith(transaction, {
			collectionId: CollectionId,
			actorProfileId: ProfileId,
		});
	});

	it("rejects an existing Favorites Collection with a different fixed identity", async () => {
		const existingId = "019fada1-d542-7366-ac82-45219e9fbb55";
		const { transaction, insert } = transactionWithExistingFavorites(existingId);

		await expect(
			ensureFixedFavoritesInTransaction(transaction, {
				profileId: ProfileId,
				collectionId: CollectionId,
				createdAt: BootstrapEpoch,
			}),
		).rejects.toThrow(
			`Fixed Favorites Collection for Profile ${ProfileId} has unexpected Unit ID ${existingId}`,
		);
		expect(insert).not.toHaveBeenCalled();
		expect(insertUnit).not.toHaveBeenCalled();
	});
});
