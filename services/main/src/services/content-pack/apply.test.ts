import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";

import type { DatabaseTransaction } from "../database";
import { OfficialProfileIds } from "../bootstrap/data";
import type { PackObject } from "./contracts";
import {
	applyContentPack,
	assertShowcaseFixtureInstallState,
	recordImportedCollectionStructureHistories,
} from "./apply";
import type { LoadedPack } from "./contracts";
import { ContentPackConflict } from "./errors";

const createCollectionStructureHistory = vi.hoisted(() => vi.fn());

vi.mock("../collection-structure/history", () => ({ createCollectionStructureHistory }));

const Checksum = "a".repeat(64);
const CollectionId = "019c0000-0000-7000-8000-000000000001";

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

function emptyPack(): LoadedPack {
	return {
		packDir: "D:/showcase-fixture",
		manifest: { id: "empty-showcase-fixture", version: "1.0.0" },
		checksum: Checksum,
		ids: { units: {} },
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
		objects: [],
		relations: {},
		structures: [],
	};
}

describe("applyContentPack local showcase boundary", () => {
	it("records the populated initial structure for every imported Collection", async () => {
		const transaction = {} as DatabaseTransaction;
		const pack = emptyPack();
		const collection = collectionObject();
		createCollectionStructureHistory.mockResolvedValue({
			revisionId: "019c0000-0000-7000-8000-000000000002",
			revisionCreated: true,
		});

		await recordImportedCollectionStructureHistories(
			transaction,
			{ ...pack, ids: { units: { [collection.sourceKey]: CollectionId } } },
			[collection],
		);

		expect(createCollectionStructureHistory).toHaveBeenCalledOnce();
		expect(createCollectionStructureHistory).toHaveBeenCalledWith(transaction, {
			collectionId: CollectionId,
			actorProfileId: OfficialProfileIds.editorial,
		});
	});

	it("serializes local loads and treats an empty fixture as a mutation-free no-op", async () => {
		const execute = vi.fn(async (_statement: SQL) => ({ rows: [] }));
		const transaction = { execute } as unknown as DatabaseTransaction;

		await expect(applyContentPack(transaction, emptyPack(), "D:/packs")).resolves.toEqual({
			status: "noop",
			created: 0,
		});
		expect(execute).toHaveBeenCalledTimes(1);
		const advisorySql = new PgDialect()
			.sqlToQuery(execute.mock.calls[0]![0] as SQL)
			.sql.toLowerCase()
			.replaceAll(/\s+/g, " ");
		expect(advisorySql).toContain("pg_advisory_xact_lock");
		expect(advisorySql).toContain("hashtextextended");
	});

	it("requires a reset instead of updating a partially populated local database", () => {
		expect(() => assertShowcaseFixtureInstallState({ createCount: 1, noopCount: 1 })).toThrow(
			expect.objectContaining({
				name: ContentPackConflict.name,
				message:
					"A showcase fixture cannot update a partially populated database; reset the local database and load it again",
			}),
		);
	});
});
