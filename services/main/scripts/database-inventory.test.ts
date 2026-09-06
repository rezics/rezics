import { describe, expect, it, vi } from "vitest";
import { captureDatabaseInventory } from "./database-inventory";

describe("database inventory boundaries", () => {
	it("uses a read-only transaction, rolls back, and does not claim backup or exact-count evidence", async () => {
		const query = vi.fn(async (_text: string, _values?: unknown[]) => ({ rows: [] }));
		const inventory = await captureDatabaseInventory({ query }, "local");
		expect(query.mock.calls[0]?.[0]).toBe("begin isolation level repeatable read read only");
		expect(query.mock.calls.at(-1)?.[0]).toBe("rollback");
		expect(inventory.evidence).toMatchObject({
			exactCounts: false,
			applicationRowsRead: false,
			recoverableBackupVerified: false,
		});
		const statements = query.mock.calls.map((call) => call[0]).join("\n");
		expect(statements).not.toMatch(
			/\b(insert|update|delete|count\s*\(|archive_command|password)\b/i,
		);
		expect(query.mock.calls.flatMap((call) => call[1] ?? []).flat()).not.toContain(
			"archive_command",
		);
	});

	it("closes the transaction when a catalog read fails", async () => {
		const query = vi.fn(async (text: string) => {
			if (text.includes("from pg_class")) throw new Error("inventory denied");
			return { rows: [] };
		});
		await expect(captureDatabaseInventory({ query }, "production")).rejects.toThrow(
			"inventory denied",
		);
		expect(query.mock.calls.at(-1)?.[0]).toBe("rollback");
	});
});
