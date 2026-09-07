import { sql } from "drizzle-orm";
import { check, foreignKey, index, primaryKey, text, uuid } from "drizzle-orm/pg-core";
import { pgTable } from "./base";
import { catalogDefinitionRevision } from "./catalog-identity";
import { referenceConcept } from "./catalog-reference";
import { catalogSourceSnapshot } from "./catalog-source";

/** An exact class/vocabulary meaning may designate a named native concept. */
export const catalogDefinitionTerm = pgTable(
	"catalog_definition_term",
	{
		definitionRevisionId: uuid()
			.primaryKey()
			.references(() => catalogDefinitionRevision.id, { onDelete: "restrict" }),
		conceptId: uuid()
			.notNull()
			.references(() => referenceConcept.id, { onDelete: "restrict" }),
	},
	(table) => [
		index("catalog_definition_term_concept_idx").on(table.conceptId, table.definitionRevisionId),
	],
);

/** Evidence for the governed-meaning-to-concept link; names and parents retain their own evidence. */
export const catalogDefinitionTermSupport = pgTable(
	"catalog_definition_term_support",
	{
		definitionRevisionId: uuid()
			.notNull()
			.references(() => catalogDefinitionTerm.definitionRevisionId, { onDelete: "restrict" }),
		sourceRecordId: uuid().notNull(),
		snapshotId: uuid().notNull(),
		sourcePath: text().notNull(),
	},
	(table) => [
		primaryKey({
			columns: [
				table.definitionRevisionId,
				table.sourceRecordId,
				table.snapshotId,
				table.sourcePath,
			],
		}),
		foreignKey({
			name: "catalog_definition_term_support_snapshot_fk",
			columns: [table.sourceRecordId, table.snapshotId],
			foreignColumns: [catalogSourceSnapshot.sourceRecordId, catalogSourceSnapshot.id],
		}).onDelete("restrict"),
		index("catalog_definition_term_support_source_idx").on(
			table.sourceRecordId,
			table.snapshotId,
			table.definitionRevisionId,
			table.sourcePath,
		),
		check(
			"catalog_definition_term_support_path_check",
			sql`left(${table.sourcePath}, 1) = '/' and octet_length(${table.sourcePath}) <= 1024`,
		),
	],
);
