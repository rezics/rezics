import { inArray, sql } from "drizzle-orm";
import {
	bigint,
	boolean,
	check,
	foreignKey,
	index,
	integer,
	jsonb,
	primaryKey,
	text,
	uuid,
} from "drizzle-orm/pg-core";
import { pgTable } from "./base";
import { catalogSourceBindingRevision, catalogSourceSnapshot } from "./catalog-source";
import { catalogSourceApplication } from "./catalog-source-application";
import { CatalogStructureHistoryTables } from "./catalog-structure-history";
import { CatalogIdentityTables, catalogDefinitionRevision } from "./catalog-identity";
import { CatalogOwnerValues, type CatalogOwner } from "../../catalog/contracts";
import type {
	StructureSourceComponent,
	StructureSourceValue,
} from "../../catalog/structure-source-contracts";

function nativeColumns() {
	return {
		ownerId: uuid().notNull(),
		component: text().$type<StructureSourceComponent>().notNull(),
		componentKey: text().notNull(),
	};
}
function sourceColumns() {
	return {
		sourceRecordId: uuid().notNull(),
		mappingKey: uuid().notNull(),
		correspondenceRevision: bigint({ mode: "number" }).notNull(),
		mappingOwner: text().$type<CatalogOwner>().notNull(),
	};
}
function structureSource(owner: "program" | "publishing") {
	const history = CatalogStructureHistoryTables[owner].history;
	const components: StructureSourceComponent[] =
		owner === "program"
			? ["program_work", "program_season", "program_version", "program_episode"]
			: [
					"publishing_work",
					"publishing_text_version",
					"publishing_publication",
					"publishing_serialization",
				];
	const occurrence = pgTable(
		`${owner}_structure_source_occurrence`,
		{
			...sourceColumns(),
			snapshotId: uuid().notNull(),
			...nativeColumns(),
			sourcePath: text().notNull(),
			historyId: uuid().notNull(),
			sourceValue: jsonb().$type<StructureSourceValue>().notNull(),
			observedFields: text().array().notNull(),
			sourceParentId: uuid()
				.generatedAlwaysAs(
					sql.raw(
						`(source_value->'fields'->>'${owner === "program" ? "programId" : "textVersionId"}')::uuid`,
					),
				)
				.references(() => CatalogIdentityTables[owner].id, { onDelete: "restrict" }),
			sourceSecondaryParentId: uuid()
				.generatedAlwaysAs(
					owner === "program" ? sql`(source_value->'fields'->>'seasonId')::uuid` : sql`null::uuid`,
				)
				.references(() => CatalogIdentityTables[owner].id, { onDelete: "restrict" }),
			sourceTypeRevisionId: uuid()
				.generatedAlwaysAs(
					sql.raw(
						`(source_value->'fields'->>'${owner === "program" ? "typeRevisionId" : "statusRevisionId"}')::uuid`,
					),
				)
				.references(() => catalogDefinitionRevision.id, { onDelete: "restrict" }),
			sourceMethodRevisionId: uuid()
				.generatedAlwaysAs(
					sql.raw(
						`(source_value->'fields'->>'${owner === "program" ? "versionTypeRevisionId" : "methodRevisionId"}')::uuid`,
					),
				)
				.references(() => catalogDefinitionRevision.id, { onDelete: "restrict" }),
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
				name: `${owner}_structure_source_epoch_fk`,
				columns: [t.sourceRecordId, t.mappingKey, t.correspondenceRevision],
				foreignColumns: [
					catalogSourceBindingRevision.sourceRecordId,
					catalogSourceBindingRevision.mappingKey,
					catalogSourceBindingRevision.revision,
				],
			}).onDelete("restrict"),
			foreignKey({
				name: `${owner}_structure_source_snapshot_fk`,
				columns: [t.sourceRecordId, t.snapshotId],
				foreignColumns: [catalogSourceSnapshot.sourceRecordId, catalogSourceSnapshot.id],
			}).onDelete("restrict"),
			foreignKey({
				name: `${owner}_structure_source_history_fk`,
				columns: [t.ownerId, t.historyId],
				foreignColumns: [history.ownerId, history.id],
			}).onDelete("restrict"),
			index(`${owner}_structure_source_native_idx`).on(t.ownerId, t.historyId, t.sourceRecordId),
			index(`${owner}_structure_source_parent_idx`)
				.on(t.sourceParentId)
				.where(sql`${t.sourceParentId} is not null`),
			index(`${owner}_structure_source_secondary_idx`)
				.on(t.sourceSecondaryParentId)
				.where(sql`${t.sourceSecondaryParentId} is not null`),
			index(`${owner}_structure_source_type_idx`)
				.on(t.sourceTypeRevisionId)
				.where(sql`${t.sourceTypeRevisionId} is not null`),
			index(`${owner}_structure_source_method_idx`)
				.on(t.sourceMethodRevisionId)
				.where(sql`${t.sourceMethodRevisionId} is not null`),
			check(`${owner}_structure_source_owner`, inArray(t.mappingOwner, CatalogOwnerValues)),
			check(`${owner}_structure_source_components`, inArray(t.component, components)),
			check(
				`${owner}_structure_source_values`,
				sql`${t.correspondenceRevision} between 1 and 9007199254740991 and octet_length(${t.component}) between 1 and 96 and ${t.componentKey}=${t.ownerId}::text and left(${t.sourcePath},1)='/' and octet_length(${t.sourcePath}) between 1 and 512 and jsonb_typeof(${t.sourceValue})='object' and ${t.sourceValue} ?& array['shape','fields'] and ${t.sourceValue}-'shape'-'fields'='{}'::jsonb and jsonb_typeof(${t.sourceValue}->'shape')='string' and jsonb_typeof(${t.sourceValue}->'fields')='object' and octet_length(${t.sourceValue}::text)<=1048576 and cardinality(${t.observedFields}) between 0 and 32`,
			),
		],
	);
	const application = pgTable(
		`${owner}_structure_source_application_change`,
		{
			sourceRecordId: uuid().notNull(),
			proposalId: uuid().notNull(),
			action: text().$type<"apply" | "withdraw">().notNull(),
			position: integer().notNull(),
			...nativeColumns(),
			beforeRevisionId: uuid().notNull(),
			afterRevisionId: uuid().notNull(),
		},
		(t) => [
			primaryKey({ columns: [t.sourceRecordId, t.proposalId, t.action, t.position] }),
			foreignKey({
				name: `${owner}_structure_application_journal_fk`,
				columns: [t.sourceRecordId, t.proposalId, t.action],
				foreignColumns: [
					catalogSourceApplication.sourceRecordId,
					catalogSourceApplication.proposalId,
					catalogSourceApplication.action,
				],
			}).onDelete("restrict"),
			foreignKey({
				name: `${owner}_structure_application_before_fk`,
				columns: [t.ownerId, t.beforeRevisionId],
				foreignColumns: [history.ownerId, history.id],
			}).onDelete("restrict"),
			foreignKey({
				name: `${owner}_structure_application_after_fk`,
				columns: [t.ownerId, t.afterRevisionId],
				foreignColumns: [history.ownerId, history.id],
			}).onDelete("restrict"),
			check(`${owner}_structure_application_components`, inArray(t.component, components)),
			check(
				`${owner}_structure_application_values`,
				sql`${t.position} between 0 and 127 and ${t.action} in ('apply','withdraw') and octet_length(${t.component}) between 1 and 96 and ${t.componentKey}=${t.ownerId}::text and (${t.beforeRevisionId} is null or ${t.beforeRevisionId}<>${t.afterRevisionId})`,
			),
		],
	);
	const baseline = pgTable(
		`${owner}_structure_source_baseline`,
		{
			...sourceColumns(),
			...nativeColumns(),
			snapshotId: uuid().notNull(),
			sourcePath: text().notNull(),
			sourceHistoryId: uuid().notNull(),
			currentHistoryId: uuid().notNull(),
			absent: boolean().notNull(),
			proposalId: uuid().notNull(),
			action: text().$type<"apply" | "withdraw">().notNull(),
		},
		(t) => [
			primaryKey({
				columns: [
					t.sourceRecordId,
					t.mappingKey,
					t.correspondenceRevision,
					t.ownerId,
					t.component,
					t.componentKey,
				],
			}),
			foreignKey({
				name: `${owner}_structure_baseline_epoch_fk`,
				columns: [t.sourceRecordId, t.mappingKey, t.correspondenceRevision],
				foreignColumns: [
					catalogSourceBindingRevision.sourceRecordId,
					catalogSourceBindingRevision.mappingKey,
					catalogSourceBindingRevision.revision,
				],
			}).onDelete("restrict"),
			foreignKey({
				name: `${owner}_structure_baseline_occurrence_fk`,
				columns: [
					t.sourceRecordId,
					t.mappingKey,
					t.correspondenceRevision,
					t.snapshotId,
					t.ownerId,
					t.component,
					t.componentKey,
				],
				foreignColumns: [
					occurrence.sourceRecordId,
					occurrence.mappingKey,
					occurrence.correspondenceRevision,
					occurrence.snapshotId,
					occurrence.ownerId,
					occurrence.component,
					occurrence.componentKey,
				],
			}).onDelete("restrict"),
			foreignKey({
				name: `${owner}_structure_baseline_original_fk`,
				columns: [t.ownerId, t.sourceHistoryId],
				foreignColumns: [history.ownerId, history.id],
			}).onDelete("restrict"),
			foreignKey({
				name: `${owner}_structure_baseline_current_fk`,
				columns: [t.ownerId, t.currentHistoryId],
				foreignColumns: [history.ownerId, history.id],
			}).onDelete("restrict"),
			foreignKey({
				name: `${owner}_structure_baseline_application_fk`,
				columns: [t.sourceRecordId, t.proposalId, t.action],
				foreignColumns: [
					catalogSourceApplication.sourceRecordId,
					catalogSourceApplication.proposalId,
					catalogSourceApplication.action,
				],
			}).onDelete("restrict"),
			index(`${owner}_structure_baseline_current_idx`).on(t.ownerId, t.currentHistoryId),
			check(`${owner}_structure_baseline_owner`, inArray(t.mappingOwner, CatalogOwnerValues)),
			check(`${owner}_structure_baseline_components`, inArray(t.component, components)),
			check(
				`${owner}_structure_baseline_values`,
				sql`${t.action} in ('apply','withdraw') and ${t.correspondenceRevision} between 1 and 9007199254740991 and octet_length(${t.component}) between 1 and 96 and ${t.componentKey}=${t.ownerId}::text and left(${t.sourcePath},1)='/' and octet_length(${t.sourcePath}) between 1 and 512`,
			),
		],
	);
	return { occurrence, application, baseline };
}

/** Separate concrete owner families retain exact native-history and immutable source-epoch foreign keys. */
export const CatalogStructureSourceTables = {
	program: structureSource("program"),
	publishing: structureSource("publishing"),
};
export const programStructureSourceOccurrence = CatalogStructureSourceTables.program.occurrence;
export const programStructureSourceApplicationChange =
	CatalogStructureSourceTables.program.application;
export const programStructureSourceBaseline = CatalogStructureSourceTables.program.baseline;
export const publishingStructureSourceOccurrence =
	CatalogStructureSourceTables.publishing.occurrence;
export const publishingStructureSourceApplicationChange =
	CatalogStructureSourceTables.publishing.application;
export const publishingStructureSourceBaseline = CatalogStructureSourceTables.publishing.baseline;
