/** @internal Physical source placement preserves each typed primary/unique key. */
export const sourcePartitionKeys = {
	catalog_source_record: "id",
	catalog_source_snapshot: "source_record_id",
	catalog_source_application: "source_record_id",
	music_source_application_change: "source_record_id",
	software_source_component_application_change: "source_record_id",
	software_source_record_application_change: "source_record_id",
	catalog_source_mapping_claim: "source_record_id",
	catalog_source_binding_revision: "source_record_id",
	catalog_source_check_receipt: "source_record_id",
	catalog_source_adoption_proposal: "source_record_id",
	catalog_source_subscription: "source_record_id",
	catalog_source_observation_fanout: "source_record_id",
	catalog_source_check_plan: "routing_bucket",
	publishing_source_binding: "source_record_id",
	music_source_binding: "source_record_id",
	program_source_binding: "source_record_id",
	software_source_binding: "source_record_id",
	entity_source_binding: "source_record_id",
	grouping_source_binding: "source_record_id",
	reference_source_binding: "source_record_id",
	distribution_source_binding: "source_record_id",
} as const;

/** @internal Sixty-four bounded hash partitions; children precede generated foreign keys. */
export function applySourcePartitions(statements: readonly string[]): string[] {
	const seen = new Set<string>();
	const output: string[] = [];
	for (const original of statements) {
		const statement = original.trimEnd();
		const entry = Object.entries(sourcePartitionKeys).find(([name]) =>
			statement.startsWith(`CREATE TABLE "${name}" (`),
		);
		if (!entry) {
			output.push(original);
			continue;
		}
		const [table, key] = entry;
		if (seen.has(table) || !statement.endsWith(");"))
			throw new Error(`Unexpected source DDL for ${table}`);
		seen.add(table);
		output.push(`${statement.slice(0, -2)}) PARTITION BY HASH ("${key}");`);
		for (let remainder = 0; remainder < 64; remainder++)
			output.push(
				`CREATE TABLE "${table}_p${String(remainder).padStart(2, "0")}" PARTITION OF "${table}" FOR VALUES WITH (MODULUS 64, REMAINDER ${remainder});`,
			);
	}
	if (seen.size !== Object.keys(sourcePartitionKeys).length)
		throw new Error("Source partition tables missing from typed schema export");
	return output;
}
