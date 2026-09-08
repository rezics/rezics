import { sql } from "drizzle-orm";
import { bigint, check, foreignKey, primaryKey, text, uuid, jsonb } from "drizzle-orm/pg-core";
import { pgTable } from "./base";
import { catalogSourceSnapshot, catalogSourceBindingRevision } from "./catalog-source";
import { entityCatalogProfileRevision } from "./catalog-entity";
import { referenceCatalogProfileRevision } from "./catalog-reference";

export const CatalogProfileHistoryTables = {
	entity: entityCatalogProfileRevision,
	reference: referenceCatalogProfileRevision,
};
function profileSourceOccurrence(owner: keyof typeof CatalogProfileHistoryTables) {
	const history = CatalogProfileHistoryTables[owner];
	return pgTable(
		`${owner}_profile_source_occurrence`,
		{
			sourceRecordId: uuid().notNull(),
			mappingKey: uuid().notNull(),
			correspondenceRevision: bigint({ mode: "number" }).notNull(),
			snapshotId: uuid().notNull(),
			ownerId: uuid().notNull(),
			sourcePath: text().notNull(),
			revision: bigint({ mode: "number" }).notNull(),
			sourceProfile: jsonb().$type<Record<string, unknown>>().notNull(),
			observedFields: text().array().notNull(),
		},
		(t) => [
			primaryKey({
				columns: [
					t.sourceRecordId,
					t.mappingKey,
					t.correspondenceRevision,
					t.snapshotId,
					t.ownerId,
				],
			}),
			foreignKey({
				name: `${owner}_profile_source_correspondence_fk`,
				columns: [t.sourceRecordId, t.mappingKey, t.correspondenceRevision],
				foreignColumns: [
					catalogSourceBindingRevision.sourceRecordId,
					catalogSourceBindingRevision.mappingKey,
					catalogSourceBindingRevision.revision,
				],
			}).onDelete("restrict"),
			foreignKey({
				name: `${owner}_profile_source_snapshot_fk`,
				columns: [t.sourceRecordId, t.snapshotId],
				foreignColumns: [catalogSourceSnapshot.sourceRecordId, catalogSourceSnapshot.id],
			}).onDelete("restrict"),
			foreignKey({
				name: `${owner}_profile_source_history_fk`,
				columns: [t.ownerId, t.revision],
				foreignColumns: [history.ownerId, history.revision],
			}).onDelete("restrict"),
			check(
				`${owner}_profile_source_values`,
				sql`left(${t.sourcePath},1)='/' and octet_length(${t.sourcePath}) between 1 and 512 and ${t.revision} between 1 and 9007199254740991`,
			),
			check(
				`${owner}_profile_source_interpretation`,
				sql`jsonb_typeof(${t.sourceProfile})='object' and octet_length(${t.sourceProfile}::text)<=262144 and cardinality(${t.observedFields}) between 0 and 32`,
			),
		],
	);
}
export const CatalogProfileSourceTables = {
	entity: profileSourceOccurrence("entity"),
	reference: profileSourceOccurrence("reference"),
};
export const entityProfileSourceOccurrence = CatalogProfileSourceTables.entity;
export const referenceProfileSourceOccurrence = CatalogProfileSourceTables.reference;
