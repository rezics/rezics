/** @internal Drizzle has no partition model; constrain its generated DDL at this explicit boundary. */
export const operationalPartitionTables = [
	"operational_outbox",
	"operational_task_intent",
	"operational_application_receipt",
	"operational_relay_pending",
] as const;

/** @internal Preserve every typed constraint and attach physical ranges before generated FKs. */
export function applyOperationalPartitions(statements: readonly string[], complete = true): string[] {
	const seen = new Set<string>();
	const output: string[] = [];
	for (const original of statements) {
		const statement = original.trimEnd();
		const table = operationalPartitionTables.find((name) =>
			statement.startsWith(`CREATE TABLE "${name}" (`),
		);
		if (!table) {
			output.push(original);
			continue;
		}
		if (seen.has(table) || !statement.endsWith(");"))
			throw new Error(`Unexpected operational DDL for ${table}`);
		seen.add(table);
		output.push(`${statement.slice(0, -2)}) PARTITION BY RANGE ("routing_bucket");`);
		for (let partition = 0; partition < 64; partition++) {
			output.push(
				`CREATE TABLE "${table}_p${String(partition).padStart(2, "0")}" PARTITION OF "${table}" FOR VALUES FROM (${partition * 16}) TO (${(partition + 1) * 16});`,
			);
		}
	}
	if (complete && seen.size !== operationalPartitionTables.length)
		throw new Error("Operational partition tables missing from typed schema export");
	return output;
}
