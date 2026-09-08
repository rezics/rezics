import { referenceArea } from "./catalog-reference";
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
import type { ChildSourceComponent, ChildSourceValue } from "../../catalog/child-source-contracts";

function nativeColumns() {
	return {
		ownerId: uuid().notNull(),
		component: text().$type<ChildSourceComponent>().notNull(),
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
function childSource(owner: "program" | "publishing") {
	const history = CatalogStructureHistoryTables[owner].history;
	const components: ChildSourceComponent[] =
		owner === "program"
			? ["program_episode_occurrence"]
			: [
					"publishing_text_work",
					"publishing_publication_text",
					"publishing_publication_work",
					"publishing_publication_facet",
					"publishing_release_event",
					"publishing_installment",
				];
	const occurrence = pgTable(
		`${owner}_component_source_occurrence`,
		{
			...sourceColumns(),
			snapshotId: uuid().notNull(),
			...nativeColumns(),
			sourcePath: text().notNull(),
			historyId: uuid().notNull(),
			sourceValue: jsonb().$type<ChildSourceValue>().notNull(),
			observedFields: text().array().notNull(),
			sourceTargetId: uuid()
				.generatedAlwaysAs(
					owner === "program"
						? sql`(source_value->'fields'->>'episodeId')::uuid`
						: sql`(source_value->'fields'->>'targetId')::uuid`,
				)
				.references(() => CatalogIdentityTables[owner].id, { onDelete: "restrict" }),
			sourcePublisherId: uuid()
				.generatedAlwaysAs(sql`(source_value->'fields'->>'publisherEntityId')::uuid`)
				.references(() => CatalogIdentityTables.entity.id, { onDelete: "restrict" }),
			sourceAreaId: uuid()
				.generatedAlwaysAs(sql`(source_value->'fields'->>'areaId')::uuid`)
				.references(() => referenceArea.id, { onDelete: "restrict" }),
			sourceDefinitionRevisionId: uuid()
				.generatedAlwaysAs(
					sql`coalesce(source_value->'fields'->>'definitionRevisionId',source_value->'fields'->>'kindRevisionId')::uuid`,
				)
				.references(() => catalogDefinitionRevision.id, { onDelete: "restrict" }),
			sourceParentComponent: text().generatedAlwaysAs(
				sql`case when source_value->'fields'->>'parentId' is not null then 'publishing_installment' else null end`,
			),
			sourceParentKey: text().generatedAlwaysAs(sql`source_value->'fields'->>'parentId'`),
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
				name: `${owner}_component_source_epoch_fk`,
				columns: [t.sourceRecordId, t.mappingKey, t.correspondenceRevision],
				foreignColumns: [
					catalogSourceBindingRevision.sourceRecordId,
					catalogSourceBindingRevision.mappingKey,
					catalogSourceBindingRevision.revision,
				],
			}).onDelete("restrict"),
			foreignKey({
				name: `${owner}_component_source_snapshot_fk`,
				columns: [t.sourceRecordId, t.snapshotId],
				foreignColumns: [catalogSourceSnapshot.sourceRecordId, catalogSourceSnapshot.id],
			}).onDelete("restrict"),
			foreignKey({
				name: `${owner}_component_source_history_fk`,
				columns: [t.ownerId, t.historyId],
				foreignColumns: [history.ownerId, history.id],
			}).onDelete("restrict"),
			index(`${owner}_component_source_native_idx`).on(t.ownerId, t.historyId, t.sourceRecordId),
			index(`${owner}_component_source_target_idx`)
				.on(t.sourceTargetId)
				.where(sql`${t.sourceTargetId} is not null`),
			index(`${owner}_component_source_publisher_idx`)
				.on(t.sourcePublisherId)
				.where(sql`${t.sourcePublisherId} is not null`),
			index(`${owner}_component_source_area_idx`)
				.on(t.sourceAreaId)
				.where(sql`${t.sourceAreaId} is not null`),
			index(`${owner}_component_source_definition_idx`)
				.on(t.sourceDefinitionRevisionId)
				.where(sql`${t.sourceDefinitionRevisionId} is not null`),
			foreignKey({
				name: `${owner}_component_source_parent_head_fk`,
				columns: [t.ownerId, t.sourceParentComponent, t.sourceParentKey],
				foreignColumns: [
					CatalogStructureHistoryTables[owner].head.ownerId,
					CatalogStructureHistoryTables[owner].head.component,
					CatalogStructureHistoryTables[owner].head.componentKey,
				],
			}).onDelete("restrict"),
			check(`${owner}_component_source_owner`, inArray(t.mappingOwner, CatalogOwnerValues)),
			check(`${owner}_component_source_components`, inArray(t.component, components)),
			check(
				`${owner}_component_source_values`,
				sql`${t.correspondenceRevision} between 1 and 9007199254740991 and octet_length(${t.component}) between 1 and 96 and octet_length(${t.componentKey})=36 and left(${t.sourcePath},1)='/' and octet_length(${t.sourcePath}) between 1 and 512 and jsonb_typeof(${t.sourceValue})='object' and ${t.sourceValue} ?& array['kind','fields'] and ${t.sourceValue}-'kind'-'fields'='{}'::jsonb and jsonb_typeof(${t.sourceValue}->'kind')='string' and jsonb_typeof(${t.sourceValue}->'fields')='object' and octet_length(${t.sourceValue}::text)<=1048576 and cardinality(${t.observedFields}) between 0 and 32`,
			),
		],
	);
	const application = pgTable(
		`${owner}_component_source_application_change`,
		{
			sourceRecordId: uuid().notNull(),
			proposalId: uuid().notNull(),
			action: text().$type<"apply" | "withdraw">().notNull(),
			position: integer().notNull(),
			...nativeColumns(),
			beforeRevisionId: uuid(),
			afterRevisionId: uuid().notNull(),
		},
		(t) => [
			primaryKey({ columns: [t.sourceRecordId, t.proposalId, t.action, t.position] }),
			foreignKey({
				name: `${owner}_child_application_journal_fk`,
				columns: [t.sourceRecordId, t.proposalId, t.action],
				foreignColumns: [
					catalogSourceApplication.sourceRecordId,
					catalogSourceApplication.proposalId,
					catalogSourceApplication.action,
				],
			}).onDelete("restrict"),
			foreignKey({
				name: `${owner}_child_application_before_fk`,
				columns: [t.ownerId, t.beforeRevisionId],
				foreignColumns: [history.ownerId, history.id],
			}).onDelete("restrict"),
			foreignKey({
				name: `${owner}_child_application_after_fk`,
				columns: [t.ownerId, t.afterRevisionId],
				foreignColumns: [history.ownerId, history.id],
			}).onDelete("restrict"),
			check(`${owner}_child_application_components`, inArray(t.component, components)),
			check(
				`${owner}_child_application_values`,
				sql`${t.position} between 0 and 127 and ${t.action} in ('apply','withdraw') and octet_length(${t.component}) between 1 and 96 and octet_length(${t.componentKey})=36 and (${t.beforeRevisionId} is null or ${t.beforeRevisionId}<>${t.afterRevisionId})`,
			),
		],
	);
	const baseline = pgTable(
		`${owner}_component_source_baseline`,
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
				name: `${owner}_child_baseline_epoch_fk`,
				columns: [t.sourceRecordId, t.mappingKey, t.correspondenceRevision],
				foreignColumns: [
					catalogSourceBindingRevision.sourceRecordId,
					catalogSourceBindingRevision.mappingKey,
					catalogSourceBindingRevision.revision,
				],
			}).onDelete("restrict"),
			foreignKey({
				name: `${owner}_child_baseline_occurrence_fk`,
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
				name: `${owner}_child_baseline_original_fk`,
				columns: [t.ownerId, t.sourceHistoryId],
				foreignColumns: [history.ownerId, history.id],
			}).onDelete("restrict"),
			foreignKey({
				name: `${owner}_child_baseline_current_fk`,
				columns: [t.ownerId, t.currentHistoryId],
				foreignColumns: [history.ownerId, history.id],
			}).onDelete("restrict"),
			foreignKey({
				name: `${owner}_child_baseline_application_fk`,
				columns: [t.sourceRecordId, t.proposalId, t.action],
				foreignColumns: [
					catalogSourceApplication.sourceRecordId,
					catalogSourceApplication.proposalId,
					catalogSourceApplication.action,
				],
			}).onDelete("restrict"),
			index(`${owner}_child_baseline_current_idx`).on(t.ownerId, t.currentHistoryId),
			check(`${owner}_child_baseline_owner`, inArray(t.mappingOwner, CatalogOwnerValues)),
			check(`${owner}_child_baseline_components`, inArray(t.component, components)),
			check(
				`${owner}_child_baseline_values`,
				sql`${t.action} in ('apply','withdraw') and ${t.correspondenceRevision} between 1 and 9007199254740991 and octet_length(${t.component}) between 1 and 96 and octet_length(${t.componentKey})=36 and left(${t.sourcePath},1)='/' and octet_length(${t.sourcePath}) between 1 and 512`,
			),
		],
	);
	return { occurrence, application, baseline };
}

/** Separate concrete owner families retain exact native-history and immutable source-epoch foreign keys. */
export const CatalogChildSourceTables = {
	program: childSource("program"),
	publishing: childSource("publishing"),
};
export const programComponentSourceOccurrence = CatalogChildSourceTables.program.occurrence;
export const programComponentSourceApplicationChange = CatalogChildSourceTables.program.application;
export const programComponentSourceBaseline = CatalogChildSourceTables.program.baseline;
export const publishingComponentSourceOccurrence = CatalogChildSourceTables.publishing.occurrence;
export const publishingComponentSourceApplicationChange =
	CatalogChildSourceTables.publishing.application;
export const publishingComponentSourceBaseline = CatalogChildSourceTables.publishing.baseline;
