import { sql } from "drizzle-orm";
import { bigint, check, foreignKey, primaryKey, text, uuid } from "drizzle-orm/pg-core";
import { pgTable } from "./base";
import { catalogSourceSnapshot } from "./catalog-source";
import { softwareComponentRevision, softwareRecordRevision } from "./catalog-software";

/** Source-adopted software rows retain an exact native history key before or after compensation. */
export const softwareComponentSourceOccurrence = pgTable(
	"software_component_source_occurrence",
	{
		sourceRecordId: uuid().notNull(),
		snapshotId: uuid().notNull(),
		ownerId: uuid().notNull(),
		component: text().$type<typeof softwareComponentRevision.$inferSelect.kind>().notNull(),
		componentKey: text().notNull(),
		revision: bigint({ mode: "number" }).notNull(),
		sourcePath: text().notNull(),
	},
	(t) => [
		primaryKey({
			columns: [t.sourceRecordId, t.snapshotId, t.ownerId, t.component, t.componentKey],
		}),
		foreignKey({
			name: "software_component_source_snapshot_fk",
			columns: [t.sourceRecordId, t.snapshotId],
			foreignColumns: [catalogSourceSnapshot.sourceRecordId, catalogSourceSnapshot.id],
		}).onDelete("restrict"),
		foreignKey({
			name: "software_component_source_revision_fk",
			columns: [t.ownerId, t.component, t.componentKey, t.revision],
			foreignColumns: [
				softwareComponentRevision.releaseId,
				softwareComponentRevision.kind,
				softwareComponentRevision.componentId,
				softwareComponentRevision.revision,
			],
		}).onDelete("restrict"),
		check(
			"software_component_source_path_check",
			sql`octet_length(${t.sourcePath}) between 1 and 512 and left(${t.sourcePath},1) = '/'`,
		),
	],
);
export const softwareRecordSourceOccurrence = pgTable(
	"software_record_source_occurrence",
	{
		sourceRecordId: uuid().notNull(),
		snapshotId: uuid().notNull(),
		ownerId: uuid().notNull(),
		revision: bigint({ mode: "number" }).notNull(),
		sourcePath: text().notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.sourceRecordId, t.snapshotId, t.ownerId] }),
		foreignKey({
			name: "software_record_source_snapshot_fk",
			columns: [t.sourceRecordId, t.snapshotId],
			foreignColumns: [catalogSourceSnapshot.sourceRecordId, catalogSourceSnapshot.id],
		}).onDelete("restrict"),
		foreignKey({
			name: "software_record_source_revision_fk",
			columns: [t.ownerId, t.revision],
			foreignColumns: [softwareRecordRevision.ownerId, softwareRecordRevision.revision],
		}).onDelete("restrict"),
		check(
			"software_record_source_path_check",
			sql`octet_length(${t.sourcePath}) between 1 and 512 and left(${t.sourcePath},1) = '/'`,
		),
	],
);
