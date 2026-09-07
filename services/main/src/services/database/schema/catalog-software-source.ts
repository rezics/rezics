import { sql } from "drizzle-orm";
import { bigint, check, foreignKey, jsonb, primaryKey, text, uuid } from "drizzle-orm/pg-core";
import { pgTable } from "./base";
import { catalogSourceSnapshot, catalogSourceBindingRevision } from "./catalog-source";
import { softwareComponentRevision, softwareRecordRevision } from "./catalog-software";

/** Source-adopted software rows retain an exact native history key before or after compensation. */
export const softwareComponentSourceOccurrence = pgTable(
	"software_component_source_occurrence",
	{
		sourceRecordId: uuid().notNull(),
		mappingKey: uuid().notNull(),
		correspondenceRevision: bigint({ mode: "number" }).notNull(),
		snapshotId: uuid().notNull(),
		ownerId: uuid().notNull(),
		component: text().$type<typeof softwareComponentRevision.$inferSelect.kind>().notNull(),
		componentKey: text().notNull(),
		revision: bigint({ mode: "number" }).notNull(),
		sourcePath: text().notNull(),
	},
	(t) => [
		primaryKey({
			columns: [
				t.sourceRecordId,
				t.mappingKey,
				t.correspondenceRevision,
				t.snapshotId,
				t.ownerId,
				t.component,
				t.componentKey,
			],
		}),
		foreignKey({
			name: "software_component_source_correspondence_fk",
			columns: [t.sourceRecordId, t.mappingKey, t.correspondenceRevision],
			foreignColumns: [
				catalogSourceBindingRevision.sourceRecordId,
				catalogSourceBindingRevision.mappingKey,
				catalogSourceBindingRevision.revision,
			],
		}).onDelete("restrict"),
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
		mappingKey: uuid().notNull(),
		correspondenceRevision: bigint({ mode: "number" }).notNull(),
		snapshotId: uuid().notNull(),
		ownerId: uuid().notNull(),
		revision: bigint({ mode: "number" }).notNull(),
		sourceShape: text().$type<"content" | "release">().notNull(),
		sourceValue: jsonb().$type<unknown>().notNull(),
		sourcePath: text().notNull(),
	},
	(t) => [
		primaryKey({
			columns: [t.sourceRecordId, t.mappingKey, t.correspondenceRevision, t.snapshotId, t.ownerId],
		}),
		foreignKey({
			name: "software_record_source_correspondence_fk",
			columns: [t.sourceRecordId, t.mappingKey, t.correspondenceRevision],
			foreignColumns: [
				catalogSourceBindingRevision.sourceRecordId,
				catalogSourceBindingRevision.mappingKey,
				catalogSourceBindingRevision.revision,
			],
		}).onDelete("restrict"),
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
			"software_record_source_value_check",
			sql`${t.sourceShape} in ('content','release') and jsonb_typeof(${t.sourceValue}) = 'object' and octet_length(${t.sourceValue}::text) <= 2097152`,
		),
		check(
			"software_record_source_value_shape_check",
			sql`case ${t.sourceShape} when 'content' then
				${t.sourceValue} ?& array['originalLanguageTag','developmentStatus','description'] and ${t.sourceValue} - array['originalLanguageTag','developmentStatus','description'] = '{}'::jsonb
				and jsonb_typeof(${t.sourceValue}->'originalLanguageTag') in ('null','string') and jsonb_typeof(${t.sourceValue}->'description') in ('null','string')
				and (jsonb_typeof(${t.sourceValue}->'developmentStatus') = 'null' or ${t.sourceValue}->>'developmentStatus' in ('finished','in_development','cancelled'))
			when 'release' then
				${t.sourceValue} ?& array['typeRevisionId','isPatch','freeware','uncensored','hasEroticContent','minimumAge','resolution','engine','voicing','notes','gtin','catalogNumber','date']
				and ${t.sourceValue} - array['typeRevisionId','isPatch','freeware','uncensored','hasEroticContent','minimumAge','resolution','engine','voicing','notes','gtin','catalogNumber','date'] = '{}'::jsonb
				and jsonb_typeof(${t.sourceValue}->'typeRevisionId') in ('null','string') and jsonb_typeof(${t.sourceValue}->'engine') in ('null','string')
				and jsonb_typeof(${t.sourceValue}->'notes') in ('null','string') and jsonb_typeof(${t.sourceValue}->'gtin') in ('null','string') and jsonb_typeof(${t.sourceValue}->'catalogNumber') in ('null','string')
				and jsonb_typeof(${t.sourceValue}->'isPatch') in ('null','boolean') and jsonb_typeof(${t.sourceValue}->'freeware') in ('null','boolean')
				and jsonb_typeof(${t.sourceValue}->'uncensored') in ('null','boolean') and jsonb_typeof(${t.sourceValue}->'hasEroticContent') in ('null','boolean')
				and jsonb_typeof(${t.sourceValue}->'minimumAge') in ('null','number') and jsonb_typeof(${t.sourceValue}->'resolution') in ('null','object') and jsonb_typeof(${t.sourceValue}->'date') = 'object'
				and (jsonb_typeof(${t.sourceValue}->'voicing') = 'null' or ${t.sourceValue}->>'voicing' in ('none','erotic_only','partial','full'))
			else false end`,
		),
		check(
			"software_record_source_path_check",
			sql`octet_length(${t.sourcePath}) between 1 and 512 and left(${t.sourcePath},1) = '/'`,
		),
	],
);
