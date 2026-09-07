import { CatalogOwnerValues } from "@rezics/reference";

/** @internal Physical source placement preserves each typed primary/unique key. */
export const sourcePartitionKeys = {
	catalog_definition_term_support: "source_record_id",
	catalog_source_proposal_dependency: "source_record_id",
	...Object.fromEntries(
		["entity", "reference"].flatMap((owner) =>
			[
				`${owner}_profile_source_occurrence`,
				`${owner}_source_profile_baseline`,
				`${owner}_source_profile_application_change`,
			].map((name) => [name, "source_record_id"]),
		),
	),
	...Object.fromEntries(
		CatalogOwnerValues.map((owner) => [`${owner}_source_owned_baseline`, "source_record_id"]),
	),
	software_source_record_baseline: "source_record_id",
	software_source_component_baseline: "source_record_id",
	software_source_context_baseline: "source_record_id",
	software_source_participation_baseline: "source_record_id",
	software_record_source_occurrence: "source_record_id",
	software_component_source_occurrence: "source_record_id",
	...Object.fromEntries(
		CatalogOwnerValues.flatMap((owner) =>
			["semantic", "name", "authority", "identifier"].map((kind) => [
				`${owner}_source_${kind}_application_change`,
				"source_record_id",
			]),
		),
	),
	software_source_context_application_change: "source_record_id",
	software_source_participation_application_change: "source_record_id",
	music_component_source_baseline: "source_record_id",
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
