import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";

import type { DatabaseTransaction } from "../database";
import { applyContentPack } from "./apply";
import type { LoadedPack } from "./contracts";
import { ContentPackConflict } from "./errors";

const Checksum = "a".repeat(64);

function pack(checksum = Checksum): LoadedPack {
	return {
		packDir: "D:/content-pack-fixture",
		manifest: { id: "ledger-fixture", version: "1.0.0" },
		checksum,
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
					role: "test evidence",
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

function transactionWithRecordedChecksum(checksum: string): {
	readonly transaction: DatabaseTransaction;
	readonly execute: ReturnType<typeof vi.fn>;
	readonly insert: ReturnType<typeof vi.fn>;
} {
	const execute = vi.fn(async (_statement: SQL) => ({ rows: [] }));
	const insert = vi.fn();
	const limit = vi.fn(async () => [{ checksum }]);
	const where = vi.fn(() => ({ limit }));
	const from = vi.fn(() => ({ where }));
	const select = vi.fn(() => ({ from }));
	return {
		transaction: { execute, insert, select } as unknown as DatabaseTransaction,
		execute,
		insert,
	};
}

describe("applyContentPack import ledger", () => {
	it("serializes by pack ID and makes an exact checksum replay a mutation-free no-op", async () => {
		const fixture = transactionWithRecordedChecksum(Checksum);
		await expect(applyContentPack(fixture.transaction, pack(), "D:/packs")).resolves.toEqual({
			status: "noop",
			created: 0,
		});
		expect(fixture.insert).not.toHaveBeenCalled();
		expect(fixture.execute).toHaveBeenCalledTimes(1);
		const advisorySql = new PgDialect()
			.sqlToQuery(fixture.execute.mock.calls[0]![0] as SQL)
			.sql.toLowerCase()
			.replaceAll(/\s+/g, " ");
		expect(advisorySql).toContain("pg_advisory_xact_lock");
		expect(advisorySql).toContain("hashtextextended");
	});

	it("rejects a different checksum for the same pack version before mutation", async () => {
		const fixture = transactionWithRecordedChecksum("b".repeat(64));
		await expect(applyContentPack(fixture.transaction, pack(), "D:/packs")).rejects.toEqual(
			expect.objectContaining({
				name: ContentPackConflict.name,
				message: "A different checksum is already recorded for this pack version",
			}),
		);
		expect(fixture.insert).not.toHaveBeenCalled();
		expect(fixture.execute).toHaveBeenCalledTimes(1);
	});
});
