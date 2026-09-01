import { describe, expect, it, vi } from "vitest";

import type { DatabaseTransaction } from "../database";
import type { LoadedPack, PackObject } from "./contracts";
import { ContentPackInvalid } from "./errors";
import { verifyContentPack } from "./verify";

const CollectionId = "019c0000-0000-7000-8000-000000000001";
const Checksum = "a".repeat(64);

function collectionObject(): PackObject {
	return {
		sourceKey: "fixture:collection",
		unit: {
			kind: "collection",
			status: "published",
			visibility: "public",
			contentRating: "general",
			aiDisclosure: "none",
			license: null,
			moderationStatus: "approved",
			postTargetingLocked: false,
		},
		import: { ownershipMode: "community_owned", actorKind: "import" },
		localizations: [{ language: "en", title: "Fixture Collection" }],
	};
}

function collectionPack(): LoadedPack {
	const object = collectionObject();
	return {
		packDir: "D:/showcase-fixture",
		manifest: { id: "collection-showcase-fixture", version: "1.0.0" },
		checksum: Checksum,
		ids: { units: { [object.sourceKey]: CollectionId } },
		rights: [],
		sourceLock: {
			kind: "cited-sources",
			retrievedOn: "2026-08-24",
			sources: [
				{
					sourceId: "fixture",
					url: "https://example.com/source",
					title: "Fixture source",
					role: "test fixture input",
					retrievedAt: "2026-08-24",
				},
			],
		},
		bindings: [],
		objects: [object],
		relations: {},
		structures: [],
	};
}

function transactionWithResults(results: readonly (readonly object[])[]): DatabaseTransaction {
	const remaining = [...results];
	const where = vi.fn(async () => remaining.shift() ?? []);
	const from = vi.fn(() => ({ where }));
	const select = vi.fn(() => ({ from }));
	return { select } as unknown as DatabaseTransaction;
}

describe("verifyContentPack", () => {
	it("accepts imported Collections only when their structure revision head exists", async () => {
		const transaction = transactionWithResults([
			[{ id: CollectionId }],
			[{ collectionId: CollectionId }],
		]);

		await expect(verifyContentPack(transaction, collectionPack())).resolves.toEqual({
			ok: true,
			present: 1,
		});
	});

	it("reports an imported Collection without a structure revision head", async () => {
		const transaction = transactionWithResults([[{ id: CollectionId }], []]);

		await expect(verifyContentPack(transaction, collectionPack())).rejects.toThrow(
			expect.objectContaining({
				name: ContentPackInvalid.name,
				message:
					"collection-showcase-fixture is missing 1 imported Collection Structure revision heads",
			}),
		);
	});
});
