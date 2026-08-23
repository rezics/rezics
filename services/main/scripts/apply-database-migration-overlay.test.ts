import { describe, expect, it } from "vitest";

import {
	applyOverlayStatements,
	splitSqlStatements,
	type MigrationOverlayTransactionMode,
} from "./apply-database-migration-overlay";

class RecordingClient {
	readonly queries: string[] = [];

	constructor(private readonly failOn?: string) {}

	async query(query: string): Promise<void> {
		this.queries.push(query);
		if (query === this.failOn) throw new Error("fixture failure");
	}
}

describe("pre-diff migration overlay execution", () => {
	it("keeps standard overlay statements in one transaction", async () => {
		const client = new RecordingClient();
		await applyOverlayStatements(
			client,
			["CREATE TEMP TABLE guard(id int);", "INSERT INTO guard VALUES (1);"],
			"file",
		);
		expect(client.queries).toEqual([
			"BEGIN",
			"CREATE TEMP TABLE guard(id int);",
			"INSERT INTO guard VALUES (1);",
			"COMMIT",
		]);
	});

	it("rolls back a standard overlay at its failing statement", async () => {
		const client = new RecordingClient("INSERT INTO guard VALUES (1);");
		await expect(
			applyOverlayStatements(
				client,
				["CREATE TEMP TABLE guard(id int);", "INSERT INTO guard VALUES (1);"],
				"file",
			),
		).rejects.toThrow(/statement 2/);
		expect(client.queries.at(-1)).toBe("ROLLBACK");
		expect(client.queries).not.toContain("COMMIT");
	});

	it("keeps txmode-none statements in autocommit and never rolls them back", async () => {
		const client = new RecordingClient(
			"CREATE INDEX CONCURRENTLY second_idx ON public.example (id);",
		);
		await expect(
			applyOverlayStatements(
				client,
				[
					"CREATE INDEX CONCURRENTLY first_idx ON public.example (id);",
					"CREATE INDEX CONCURRENTLY second_idx ON public.example (id);",
				],
				"none",
			),
		).rejects.toThrow(/statement 2/);
		expect(client.queries).toEqual([
			"CREATE INDEX CONCURRENTLY first_idx ON public.example (id);",
			"CREATE INDEX CONCURRENTLY second_idx ON public.example (id);",
		]);
	});

	it.each<readonly [MigrationOverlayTransactionMode, number]>([
		["file", 2],
		["none", 2],
	])("splits quoted semicolons before %s execution", (_mode, expected) => {
		expect(splitSqlStatements("SELECT ';'; SELECT 1;")).toHaveLength(expected);
	});
});
