import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";

import type { DatabaseTransaction } from "../database";
import { applyContentPack, assertShowcaseFixtureInstallState } from "./apply";
import type { LoadedPack } from "./contracts";
import { ContentPackConflict } from "./errors";

const Checksum = "a".repeat(64);

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
