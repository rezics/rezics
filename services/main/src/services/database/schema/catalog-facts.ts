import { CatalogNameTables } from "./catalog-names";
import { inArray, sql } from "drizzle-orm";
import {
	type AnyPgColumn,
	bigint,
	boolean,
	check,
	foreignKey,
	index,
	integer,
	numeric,
	primaryKey,
	text,
	unique,
	uuid,
} from "drizzle-orm/pg-core";
import {
	type CatalogOwner,
	CatalogFactStateValues,
	type CatalogFactState,
	CatalogValueKindValues,
	type CatalogValueKind,
} from "../../catalog/contracts";
import { pgTable } from "./base";
import { createCreatedAtColumn, createTimestampMsColumn } from "./columns";
import { CatalogIdentityTables, catalogDefinitionRevision } from "./catalog-identity";
import { users } from "./auth";
import {
	catalogSourceMappingClaim,
	catalogSourceRecord,
	catalogSourceSnapshot,
} from "./catalog-source";

function identityColumn(owner: CatalogOwner): AnyPgColumn {
	return CatalogIdentityTables[owner].id;
}

/** One nullable concrete FK per target owner; exactly one must be populated. */
export function catalogTargetColumns() {
	return {
		publishingId: uuid().references(() => identityColumn("publishing"), { onDelete: "restrict" }),
		musicId: uuid().references(() => identityColumn("music"), { onDelete: "restrict" }),
		programId: uuid().references(() => identityColumn("program"), { onDelete: "restrict" }),
		softwareId: uuid().references(() => identityColumn("software"), { onDelete: "restrict" }),
		entityId: uuid().references(() => identityColumn("entity"), { onDelete: "restrict" }),
		groupingId: uuid().references(() => identityColumn("grouping"), { onDelete: "restrict" }),
		referenceId: uuid().references(() => identityColumn("reference"), { onDelete: "restrict" }),
		distributionId: uuid().references(() => identityColumn("distribution"), {
			onDelete: "restrict",
		}),
	};
}

type TargetColumns = { [Key in keyof ReturnType<typeof catalogTargetColumns>]: AnyPgColumn };
export function catalogTargetCount(columns: TargetColumns) {
	return sql`num_nonnulls(${columns.publishingId}, ${columns.musicId}, ${columns.programId}, ${columns.softwareId}, ${columns.entityId}, ${columns.groupingId}, ${columns.referenceId}, ${columns.distributionId})`;
}

function createOwnerFacts<const Owner extends CatalogOwner>(owner: Owner) {
	const { name, identifier } = CatalogNameTables[owner];
	const fact = pgTable(
		`${owner}_fact`,
		{
			id: uuid().default(sql`uuidv7()`).notNull(),
			ownerId: uuid()
				.notNull()
				.references(() => identityColumn(owner), { onDelete: "restrict" }),
			definitionRevisionId: uuid()
				.notNull()
				.references(() => catalogDefinitionRevision.id, { onDelete: "restrict" }),
			semanticId: uuid().notNull().default(sql`uuidv7()`),
			expectedHeadVersion: bigint({ mode: "number" }).notNull().default(0),
			state: text().$type<CatalogFactState>().default("active").notNull(),
			lastNodePosition: bigint({ mode: "number" }).default(-1).notNull(),
			spoiler: integer().notNull().default(0),
			sealedAt: createTimestampMsColumn(),
			createdAt: createCreatedAtColumn(),
		},
		(table) => [
			primaryKey({ name: `${owner}_fact_identity_key`, columns: [table.ownerId, table.id] }),
			index(`${owner}_fact_owner_idx`).on(table.ownerId, table.definitionRevisionId, table.id),
			index(`${owner}_fact_definition_idx`).on(table.definitionRevisionId, table.id),
			check(`${owner}_fact_spoiler_check`, sql`${table.spoiler} between 0 and 2`),
			check(
				`${owner}_fact_head_version_check`,
				sql`${table.expectedHeadVersion} between 0 and 9007199254740990`,
			),
			check(`${owner}_fact_state_check`, inArray(table.state, CatalogFactStateValues)),
			check(
				`${owner}_fact_node_cursor_check`,
				sql`${table.lastNodePosition} between -1 and 9007199254740991 and (${table.sealedAt} is null or ${table.lastNodePosition} >= 0)`,
			),
		],
	);
	const valueNode = pgTable(
		`${owner}_fact_value_node`,
		{
			ownerId: uuid().notNull(),
			factId: uuid().notNull(),
			position: bigint({ mode: "number" }).notNull(),
			rulePosition: integer().notNull().default(0),
			parentPosition: bigint({ mode: "number" }),
			parentKind: text().$type<"object" | "array">(),
			memberKey: text(),
			kind: text().$type<CatalogValueKind>().notNull(),
			textValue: text(),
			numberValue: numeric(),
			booleanValue: boolean(),
		},
		(table) => [
			foreignKey({
				name: `${owner}_fact_node_fact_fk`,
				columns: [table.ownerId, table.factId],
				foreignColumns: [fact.ownerId, fact.id],
			}).onDelete("restrict"),
			primaryKey({
				name: `${owner}_fact_node_position_key`,
				columns: [table.ownerId, table.factId, table.position],
			}),
			unique(`${owner}_fact_node_kind_key`).on(
				table.ownerId,
				table.factId,
				table.position,
				table.kind,
			),
			foreignKey({
				name: `${owner}_fact_node_parent_fk`,
				columns: [table.ownerId, table.factId, table.parentPosition, table.parentKind],
				foreignColumns: [table.ownerId, table.factId, table.position, table.kind],
			}).onDelete("restrict"),
			index(`${owner}_fact_node_children_idx`).on(
				table.ownerId,
				table.factId,
				table.parentPosition,
				table.position,
			),
			unique(`${owner}_fact_node_member_key`).on(
				table.ownerId,
				table.factId,
				table.parentPosition,
				table.memberKey,
			),
			check(`${owner}_fact_node_rule_check`, sql`${table.rulePosition} between 0 and 127`),
			check(`${owner}_fact_node_kind_check`, inArray(table.kind, CatalogValueKindValues)),
			check(
				`${owner}_fact_node_position_check`,
				sql`${table.position} between 0 and 9007199254740991 and (${table.parentPosition} is null or ${table.parentPosition} >= 0 and ${table.parentPosition} < ${table.position})`,
			),
			check(
				`${owner}_fact_node_parent_check`,
				sql`(${table.position} = 0 and ${table.parentPosition} is null and ${table.parentKind} is null and ${table.memberKey} is null) or (${table.position} > 0 and ${table.parentPosition} is not null and ${table.parentKind} is not null and ((${table.parentKind} = 'object' and ${table.memberKey} is not null) or (${table.parentKind} = 'array' and ${table.memberKey} is null)))`,
			),
			check(
				`${owner}_fact_node_number_check`,
				sql`${table.numberValue} is null or ${table.numberValue}::text not in ('NaN', 'Infinity', '-Infinity')`,
			),
			check(
				`${owner}_fact_node_value_check`,
				sql`(${table.kind} = 'string' and ${table.textValue} is not null and ${table.numberValue} is null and ${table.booleanValue} is null) or (${table.kind} = 'number' and ${table.numberValue} is not null and ${table.textValue} is null and ${table.booleanValue} is null) or (${table.kind} = 'boolean' and ${table.booleanValue} is not null and ${table.textValue} is null and ${table.numberValue} is null) or (${table.kind} in ('null', 'object', 'array') and ${table.textValue} is null and ${table.numberValue} is null and ${table.booleanValue} is null)`,
			),
		],
	);
	const relation = pgTable(
		`${owner}_catalog_relation`,
		{
			id: uuid().default(sql`uuidv7()`).notNull(),
			ownerId: uuid()
				.notNull()
				.references(() => identityColumn(owner), { onDelete: "restrict" }),
			definitionRevisionId: uuid()
				.notNull()
				.references(() => catalogDefinitionRevision.id, { onDelete: "restrict" }),
			semanticId: uuid().notNull().default(sql`uuidv7()`),
			expectedHeadVersion: bigint({ mode: "number" }).notNull().default(0),
			state: text().$type<CatalogFactState>().default("active").notNull(),
			revision: bigint({ mode: "number" }).default(1).notNull(),
			spoiler: integer().default(0).notNull(),
			createdAt: createCreatedAtColumn(),
		},
		(table) => [
			primaryKey({ name: `${owner}_relation_owner_id_key`, columns: [table.ownerId, table.id] }),
			index(`${owner}_relation_owner_idx`).on(table.ownerId, table.definitionRevisionId, table.id),
			index(`${owner}_relation_definition_idx`).on(table.definitionRevisionId, table.id),
			check(
				`${owner}_relation_head_version_check`,
				sql`${table.expectedHeadVersion} between 0 and 9007199254740990`,
			),
			check(`${owner}_relation_spoiler_check`, sql`${table.spoiler} between 0 and 2`),
			check(`${owner}_relation_state_check`, inArray(table.state, CatalogFactStateValues)),
			check(
				`${owner}_relation_revision_check`,
				sql`${table.revision} between 1 and 9007199254740991`,
			),
		],
	);
	const participant = pgTable(
		`${owner}_relation_participant`,
		{
			id: uuid().default(sql`uuidv7()`).notNull(),
			ownerId: uuid().notNull(),
			relationId: uuid().notNull(),
			roleRevisionId: uuid()
				.notNull()
				.references(() => catalogDefinitionRevision.id, { onDelete: "restrict" }),
			position: bigint({ mode: "number" }).notNull(),
			creditedAs: text(),
			...catalogTargetColumns(),
		},
		(table) => [
			primaryKey({ name: `${owner}_participant_identity_key`, columns: [table.ownerId, table.id] }),
			foreignKey({
				name: `${owner}_participant_relation_fk`,
				columns: [table.ownerId, table.relationId],
				foreignColumns: [relation.ownerId, relation.id],
			}).onDelete("restrict"),
			unique(`${owner}_participant_position_key`).on(
				table.ownerId,
				table.relationId,
				table.position,
			),
			index(`${owner}_participant_role_idx`).on(table.roleRevisionId, table.relationId, table.id),
			index(`${owner}_participant_publishing_idx`)
				.on(table.publishingId, table.roleRevisionId, table.relationId)
				.where(sql`${table.publishingId} is not null`),
			index(`${owner}_participant_music_idx`)
				.on(table.musicId, table.roleRevisionId, table.relationId)
				.where(sql`${table.musicId} is not null`),
			index(`${owner}_participant_program_idx`)
				.on(table.programId, table.roleRevisionId, table.relationId)
				.where(sql`${table.programId} is not null`),
			index(`${owner}_participant_software_idx`)
				.on(table.softwareId, table.roleRevisionId, table.relationId)
				.where(sql`${table.softwareId} is not null`),
			index(`${owner}_participant_entity_idx`)
				.on(table.entityId, table.roleRevisionId, table.relationId)
				.where(sql`${table.entityId} is not null`),
			index(`${owner}_participant_grouping_idx`)
				.on(table.groupingId, table.roleRevisionId, table.relationId)
				.where(sql`${table.groupingId} is not null`),
			index(`${owner}_participant_reference_idx`)
				.on(table.referenceId, table.roleRevisionId, table.relationId)
				.where(sql`${table.referenceId} is not null`),
			index(`${owner}_participant_distribution_idx`)
				.on(table.distributionId, table.roleRevisionId, table.relationId)
				.where(sql`${table.distributionId} is not null`),
			check(`${owner}_participant_target_check`, sql`${catalogTargetCount(table)} = 1`),
			check(
				`${owner}_participant_position_check`,
				sql`${table.position} between 0 and 9007199254740991`,
			),
		],
	);
	const relationScope = pgTable(
		`${owner}_relation_scope`,
		{
			id: uuid().default(sql`uuidv7()`).notNull(),
			ownerId: uuid().notNull(),
			relationId: uuid().notNull(),
			definitionRevisionId: uuid()
				.notNull()
				.references(() => catalogDefinitionRevision.id, { onDelete: "restrict" }),
			valueFactId: uuid().notNull(),
		},
		(table) => [
			primaryKey({
				name: `${owner}_relation_scope_identity_key`,
				columns: [table.ownerId, table.id],
			}),
			foreignKey({
				name: `${owner}_scope_relation_fk`,
				columns: [table.ownerId, table.relationId],
				foreignColumns: [relation.ownerId, relation.id],
			}).onDelete("restrict"),
			foreignKey({
				name: `${owner}_scope_fact_fk`,
				columns: [table.ownerId, table.valueFactId],
				foreignColumns: [fact.ownerId, fact.id],
			}).onDelete("restrict"),
			index(`${owner}_relation_scope_relation_idx`).on(
				table.ownerId,
				table.relationId,
				table.definitionRevisionId,
				table.id,
			),
			index(`${owner}_relation_scope_fact_idx`).on(table.ownerId, table.valueFactId),
			index(`${owner}_relation_scope_definition_idx`).on(table.definitionRevisionId, table.id),
		],
	);
	const change = pgTable(
		`${owner}_catalog_change`,
		{
			id: uuid().default(sql`uuidv7()`).notNull(),
			ownerId: uuid()
				.notNull()
				.references(() => identityColumn(owner), { onDelete: "restrict" }),
			version: bigint({ mode: "number" }).notNull(),
			actorAuthUserId: uuid().references(() => users.id, { onDelete: "set null" }),
			operation: text().notNull(),
			recordedAt: createCreatedAtColumn(),
			withdrawnAt: createTimestampMsColumn(),
		},
		(table) => [
			primaryKey({ name: `${owner}_change_identity_key`, columns: [table.ownerId, table.id] }),
			unique(`${owner}_change_version_key`).on(table.ownerId, table.version),
			index(`${owner}_change_actor_idx`).on(table.actorAuthUserId, table.id),
			check(`${owner}_change_version_check`, sql`${table.version} between 1 and 9007199254740991`),
			check(`${owner}_change_operation_check`, sql`length(${table.operation}) between 1 and 96`),
		],
	);
	const support = pgTable(
		`${owner}_fact_support`,
		{
			ownerId: uuid().notNull(),
			id: uuid().default(sql`uuidv7()`).notNull(),
			sourceRecordId: uuid()
				.notNull()
				.references(() => catalogSourceRecord.id, { onDelete: "restrict" }),
			snapshotId: uuid().notNull(),
			sourcePath: text().notNull(),
			factId: uuid(),
			relationId: uuid(),
			namedFormId: uuid(),
			identifierId: uuid(),
			createdAt: createCreatedAtColumn(),
			withdrawnAt: createTimestampMsColumn(),
		},
		(table) => [
			foreignKey({
				name: `${owner}_support_fact_fk`,
				columns: [table.ownerId, table.factId],
				foreignColumns: [fact.ownerId, fact.id],
			}).onDelete("restrict"),
			foreignKey({
				name: `${owner}_support_relation_fk`,
				columns: [table.ownerId, table.relationId],
				foreignColumns: [relation.ownerId, relation.id],
			}).onDelete("restrict"),
			foreignKey({
				name: `${owner}_support_named_form_fk`,
				columns: [table.ownerId, table.namedFormId],
				foreignColumns: [name.ownerId, name.id],
			}).onDelete("restrict"),
			foreignKey({
				name: `${owner}_support_identifier_fk`,
				columns: [table.ownerId, table.identifierId],
				foreignColumns: [identifier.ownerId, identifier.id],
			}).onDelete("restrict"),
			primaryKey({ name: `${owner}_support_identity_key`, columns: [table.ownerId, table.id] }),
			foreignKey({
				name: `${owner}_support_snapshot_fk`,
				columns: [table.sourceRecordId, table.snapshotId],
				foreignColumns: [catalogSourceSnapshot.sourceRecordId, catalogSourceSnapshot.id],
			}).onDelete("restrict"),
			index(`${owner}_support_snapshot_idx`).on(table.sourceRecordId, table.snapshotId, table.id),
			index(`${owner}_support_fact_idx`)
				.on(table.ownerId, table.factId, table.id)
				.where(sql`${table.factId} is not null`),
			index(`${owner}_support_relation_idx`)
				.on(table.ownerId, table.relationId, table.id)
				.where(sql`${table.relationId} is not null`),
			index(`${owner}_support_name_idx`)
				.on(table.ownerId, table.namedFormId, table.id)
				.where(sql`${table.namedFormId} is not null`),
			index(`${owner}_support_identifier_idx`)
				.on(table.ownerId, table.identifierId, table.id)
				.where(sql`${table.identifierId} is not null`),
			check(
				`${owner}_support_target_check`,
				sql`num_nonnulls(${table.factId}, ${table.relationId}, ${table.namedFormId}, ${table.identifierId}) = 1`,
			),
			check(`${owner}_support_source_path_check`, sql`length(${table.sourcePath}) > 0`),
		],
	);

	const semanticRevision = pgTable(
		`${owner}_semantic_revision`,
		{
			ownerId: uuid()
				.notNull()
				.references(() => identityColumn(owner), { onDelete: "restrict" }),
			semanticId: uuid().notNull(),
			version: bigint({ mode: "number" }).notNull(),
			factId: uuid(),
			relationId: uuid(),
			state: text().$type<CatalogFactState>().notNull().default("active"),
			actorAuthUserId: uuid().references(() => users.id, { onDelete: "set null" }),
			createdAt: createCreatedAtColumn(),
		},
		(table) => [
			primaryKey({
				name: `${owner}_semantic_revision_key`,
				columns: [table.ownerId, table.semanticId, table.version],
			}),
			foreignKey({
				name: `${owner}_semantic_revision_fact_fk`,
				columns: [table.ownerId, table.factId],
				foreignColumns: [fact.ownerId, fact.id],
			}).onDelete("restrict"),
			foreignKey({
				name: `${owner}_semantic_revision_relation_fk`,
				columns: [table.ownerId, table.relationId],
				foreignColumns: [relation.ownerId, relation.id],
			}).onDelete("restrict"),
			index(`${owner}_semantic_revision_fact_idx`).on(table.ownerId, table.factId),
			index(`${owner}_semantic_revision_relation_idx`).on(table.ownerId, table.relationId),
			check(
				`${owner}_semantic_revision_target_check`,
				sql`num_nonnulls(${table.factId},${table.relationId}) = 1`,
			),
			check(`${owner}_semantic_revision_state_check`, inArray(table.state, CatalogFactStateValues)),
			check(
				`${owner}_semantic_revision_version_check`,
				sql`${table.version} between 1 and 9007199254740991`,
			),
		],
	);
	const semanticHead = pgTable(
		`${owner}_semantic_head`,
		{
			ownerId: uuid().notNull(),
			semanticId: uuid().notNull(),
			version: bigint({ mode: "number" }).notNull(),
		},
		(table) => [
			primaryKey({
				name: `${owner}_semantic_head_key`,
				columns: [table.ownerId, table.semanticId],
			}),
			foreignKey({
				name: `${owner}_semantic_head_revision_fk`,
				columns: [table.ownerId, table.semanticId, table.version],
				foreignColumns: [
					semanticRevision.ownerId,
					semanticRevision.semanticId,
					semanticRevision.version,
				],
			}).onDelete("restrict"),
		],
	);
	const sourceBinding = pgTable(
		`${owner}_source_binding`,
		{
			sourceRecordId: uuid().notNull(),
			mappingKey: uuid().notNull(),
			mappingOwner: text().$type<Owner>().default(owner).notNull(),
			ownerId: uuid()
				.notNull()
				.references(() => identityColumn(owner), { onDelete: "restrict" }),
			createdAt: createCreatedAtColumn(),
		},
		(table) => [
			primaryKey({ columns: [table.sourceRecordId, table.mappingKey] }),
			foreignKey({
				name: `${owner}_source_binding_claim_fk`,
				columns: [table.sourceRecordId, table.mappingKey, table.mappingOwner],
				foreignColumns: [
					catalogSourceMappingClaim.sourceRecordId,
					catalogSourceMappingClaim.mappingKey,
					catalogSourceMappingClaim.owner,
				],
			}).onDelete("restrict"),
			index(`${owner}_source_binding_owner_idx`).on(table.ownerId, table.mappingKey),
			check(`${owner}_source_binding_owner_check`, sql`${table.mappingOwner} = ${owner}`),
		],
	);
	return {
		name,
		identifier,
		fact,
		valueNode,
		relation,
		participant,
		relationScope,
		change,
		support,
		sourceBinding,
		semanticRevision,
		semanticHead,
	};
}

const publishing = createOwnerFacts("publishing");
const music = createOwnerFacts("music");
const program = createOwnerFacts("program");
const software = createOwnerFacts("software");
const entity = createOwnerFacts("entity");
const grouping = createOwnerFacts("grouping");
const reference = createOwnerFacts("reference");
const distribution = createOwnerFacts("distribution");

export const {
	name: publishingNamedForm,
	identifier: publishingIdentifierClaim,
	fact: publishingFact,
	valueNode: publishingFactValueNode,
	relation: publishingCatalogRelation,
	participant: publishingRelationParticipant,
	relationScope: publishingRelationScope,
	change: publishingCatalogChange,
} = publishing;
export const {
	name: musicNamedForm,
	identifier: musicIdentifierClaim,
	fact: musicFact,
	valueNode: musicFactValueNode,
	relation: musicCatalogRelation,
	participant: musicRelationParticipant,
	relationScope: musicRelationScope,
	change: musicCatalogChange,
} = music;
export const {
	name: programNamedForm,
	identifier: programIdentifierClaim,
	fact: programFact,
	valueNode: programFactValueNode,
	relation: programCatalogRelation,
	participant: programRelationParticipant,
	relationScope: programRelationScope,
	change: programCatalogChange,
} = program;
export const {
	name: softwareNamedForm,
	identifier: softwareIdentifierClaim,
	fact: softwareFact,
	valueNode: softwareFactValueNode,
	relation: softwareCatalogRelation,
	participant: softwareRelationParticipant,
	relationScope: softwareRelationScope,
	change: softwareCatalogChange,
} = software;
export const {
	name: entityNamedForm,
	identifier: entityIdentifierClaim,
	fact: entityFact,
	valueNode: entityFactValueNode,
	relation: entityCatalogRelation,
	participant: entityRelationParticipant,
	relationScope: entityRelationScope,
	change: entityCatalogChange,
} = entity;
export const {
	name: groupingNamedForm,
	identifier: groupingIdentifierClaim,
	fact: groupingFact,
	valueNode: groupingFactValueNode,
	relation: groupingCatalogRelation,
	participant: groupingRelationParticipant,
	relationScope: groupingRelationScope,
	change: groupingCatalogChange,
} = grouping;
export const {
	name: referenceNamedForm,
	identifier: referenceIdentifierClaim,
	fact: referenceFact,
	valueNode: referenceFactValueNode,
	relation: referenceCatalogRelation,
	participant: referenceRelationParticipant,
	relationScope: referenceRelationScope,
	change: referenceCatalogChange,
} = reference;

export const CatalogFactTables = {
	publishing,
	music,
	program,
	software,
	entity,
	grouping,
	reference,
	distribution,
} as const;

export const {
	name: distributionNamedForm,
	identifier: distributionIdentifierClaim,
	fact: distributionFact,
	valueNode: distributionFactValueNode,
	relation: distributionCatalogRelation,
	participant: distributionRelationParticipant,
	relationScope: distributionRelationScope,
	change: distributionCatalogChange,
	support: distributionFactSupport,
	sourceBinding: distributionSourceBinding,
} = distribution;

export const publishingFactSupport = publishing.support;
export const musicFactSupport = music.support;
export const programFactSupport = program.support;
export const softwareFactSupport = software.support;
export const entityFactSupport = entity.support;
export const groupingFactSupport = grouping.support;
export const referenceFactSupport = reference.support;
export const publishingSourceBinding = publishing.sourceBinding;
export const musicSourceBinding = music.sourceBinding;
export const programSourceBinding = program.sourceBinding;
export const softwareSourceBinding = software.sourceBinding;
export const entitySourceBinding = entity.sourceBinding;
export const groupingSourceBinding = grouping.sourceBinding;
export const referenceSourceBinding = reference.sourceBinding;

export const publishingSemanticHead = publishing.semanticHead;
export const publishingSemanticRevision = publishing.semanticRevision;

export const musicSemanticHead = music.semanticHead;
export const musicSemanticRevision = music.semanticRevision;

export const programSemanticHead = program.semanticHead;
export const programSemanticRevision = program.semanticRevision;

export const softwareSemanticHead = software.semanticHead;
export const softwareSemanticRevision = software.semanticRevision;

export const entitySemanticHead = entity.semanticHead;
export const entitySemanticRevision = entity.semanticRevision;

export const groupingSemanticHead = grouping.semanticHead;
export const groupingSemanticRevision = grouping.semanticRevision;

export const referenceSemanticHead = reference.semanticHead;
export const referenceSemanticRevision = reference.semanticRevision;
