import { generateDrizzleJson } from "drizzle-kit/api-postgres";
import { is } from "drizzle-orm";
import { PgTable, getTableConfig } from "drizzle-orm/pg-core";
import { UnitOwnerValues } from "@rezics/reference";
import { digest, schemaId, stableJson } from "@rezics/schema/identity";
import { UnitReferenceConsumers } from "@rezics/schema/postgres/shared/unit-reference-consumers";
import { operationalPartitionTables } from "./operational-partitions";
import { sourcePartitionKeys } from "./source-partitions";
import * as schema from "../src/services/database/schema";

/** Capture the typed production model while preserving its reference-registry generation guards. @internal */
export async function captureTypedDatabaseSchema() {
	const tables = new Map(
		Object.values(schema)
			.filter((value) => is(value, PgTable))
			.map((table) => {
				const config = getTableConfig(table);
				return [config.name, new Set(config.columns.map((column) => column.name))] as const;
			}),
	);
	for (const reference of UnitReferenceConsumers) {
		const columns = tables.get(reference.table);
		if (!columns || !columns.has(reference.id))
			throw new Error(
				`Logical reference registry targets a missing table or input: ${reference.table}.${reference.id}`,
			);
		for (const owner of UnitOwnerValues) {
			const column = `${reference.prefix}_${owner}_id`;
			if (!columns.has(column))
				throw new Error(
					`Logical reference registry lacks its concrete owner alternative: ${reference.table}.${column}`,
				);
		}
	}
	for (const [table, key] of [
		...Object.entries(sourcePartitionKeys),
		...operationalPartitionTables.map((table) => [table, "routing_bucket"] as const),
	])
		if (!tables.get(table)?.has(key))
			throw new Error(
				`Physical partition registry targets a missing table or key: ${table}.${key}`,
			);
	const snapshot = await generateDrizzleJson(schema);
	const { id: _randomId, ...content } = snapshot;
	return {
		...snapshot,
		id: schemaId("typed-schema-snapshot", digest(stableJson(content))),
	};
}
