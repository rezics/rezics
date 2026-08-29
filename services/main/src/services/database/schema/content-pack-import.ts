import { sql } from "drizzle-orm";
import {
	boolean,
	check,
	foreignKey,
	index,
	integer,
	jsonb,
	primaryKey,
	smallint,
	text,
	unique,
	uuid,
} from "drizzle-orm/pg-core";

import type {
	PackBinding,
	PackManifest,
	PackRelations,
	RightsRecord,
	SourceLock,
} from "../../content-pack/schemas";
import { pgTable } from "./base";
import {
	createCreatedAtColumn,
	createJsonObjectColumn,
	createJsonObjectConstraint,
	createTimestampMsColumn,
	createUuidv7PrimaryKey,
} from "./columns";
import { profile } from "./profile";
import { entityMeasurement, subjectAssociationJudgment } from "./entity";
import { tag, unitTagJudgment } from "./tag";
import { tagPathSense, tagPathVote, unitTagPathApplicationJudgment } from "./tag-path";
import { tagExpression } from "./tag-expression";
import { guideNode, tagRelation } from "./vocabulary";

type UnitTagImport = NonNullable<PackRelations["unitTags"]>[number];
type ImportedSourceAggregate = Exclude<UnitTagImport["sourceAggregate"], null | undefined>;

export const contentPackImport = pgTable(
	"content_pack_import",
	{
		id: createUuidv7PrimaryKey(),
		packId: text().notNull(),
		version: text().notNull(),
		checksum: text().notNull(),
		sourceLockKind: text().notNull(),
		manifestSnapshot: jsonb().$type<PackManifest>().notNull(),
		sourceLockSnapshot: jsonb().$type<SourceLock>().notNull(),
		rightsSnapshot: jsonb().$type<readonly RightsRecord[]>().notNull(),
		bindingsSnapshot: jsonb().$type<readonly PackBinding[]>().notNull(),
		importerProfileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "restrict", onUpdate: "cascade" }),
		appliedAt: createTimestampMsColumn().defaultNow().notNull(),
	},
	(table) => [
		unique("content_pack_import_pack_version_key").on(table.packId, table.version),
		unique("content_pack_import_id_profile_key").on(table.id, table.importerProfileId),
		index("content_pack_import_profile_applied_idx").on(
			table.importerProfileId,
			table.appliedAt.desc(),
			table.id,
		),
		check(
			"content_pack_import_pack_id_check",
			sql`${table.packId} ~ '^[a-z0-9](?:[a-z0-9-]{0,62})$'`,
		),
		check(
			"content_pack_import_version_check",
			sql`btrim(${table.version}) <> '' and octet_length(${table.version}) <= 512`,
		),
		check("content_pack_import_checksum_check", sql`${table.checksum} ~ '^[0-9a-f]{64}$'`),
		createJsonObjectConstraint(
			"content_pack_import_manifest_snapshot_check",
			table.manifestSnapshot,
		),
		createJsonObjectConstraint(
			"content_pack_import_source_lock_snapshot_check",
			table.sourceLockSnapshot,
		),
		check(
			"content_pack_import_source_lock_kind_check",
			sql`btrim(${table.sourceLockKind}) <> ''
				and ${table.sourceLockSnapshot}->>'kind' = ${table.sourceLockKind}`,
		),
		check(
			"content_pack_import_rights_snapshot_check",
			sql`jsonb_typeof(${table.rightsSnapshot}) = 'array'`,
		),
		check(
			"content_pack_import_bindings_snapshot_check",
			sql`jsonb_typeof(${table.bindingsSnapshot}) = 'array'`,
		),
	],
);

export const contentPackTagEvidence = pgTable(
	"content_pack_tag_evidence",
	{
		importId: uuid().notNull(),
		sourceFingerprint: text().notNull(),
		tagId: uuid()
			.notNull()
			.references(() => tag.id, { onDelete: "restrict", onUpdate: "cascade" }),
		tagSourceKey: text().notNull(),
		directlyApplicable: boolean().notNull(),
		defaultSpoilerLevel: smallint(),
		sourceCategory: text(),
		parentSourceKeys: text().array().notNull(),
		primaryParentSourceKey: text(),
		sourceUrl: text().notNull(),
		sourceImportedAt: createTimestampMsColumn().notNull(),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		primaryKey({
			name: "content_pack_tag_evidence_pkey",
			columns: [table.importId, table.sourceFingerprint],
		}),
		foreignKey({
			columns: [table.importId],
			foreignColumns: [contentPackImport.id],
			name: "content_pack_tag_evidence_import_fkey",
		})
			.onUpdate("cascade")
			.onDelete("cascade"),
		index("content_pack_tag_evidence_tag_idx").on(table.tagId, table.importId),
		check(
			"content_pack_tag_evidence_source_fingerprint_check",
			sql`${table.sourceFingerprint} ~ '^[0-9a-f]{64}$'`,
		),
		check("content_pack_tag_evidence_source_key_check", sql`btrim(${table.tagSourceKey}) <> ''`),
		check(
			"content_pack_tag_evidence_spoiler_check",
			sql`${table.defaultSpoilerLevel} is null or ${table.defaultSpoilerLevel} between 0 and 2`,
		),
		check(
			"content_pack_tag_evidence_source_category_check",
			sql`${table.sourceCategory} is null or btrim(${table.sourceCategory}) <> ''`,
		),
		check(
			"content_pack_tag_evidence_parent_count_check",
			sql`cardinality(${table.parentSourceKeys}) <= 16`,
		),
		check(
			"content_pack_tag_evidence_parent_null_check",
			sql`array_position(${table.parentSourceKeys}, null) is null`,
		),
		check(
			"content_pack_tag_evidence_primary_parent_check",
			sql`(
				cardinality(${table.parentSourceKeys}) = 0
				and ${table.primaryParentSourceKey} is null
			) or (
				cardinality(${table.parentSourceKeys}) > 0
				and ${table.primaryParentSourceKey} = ${table.parentSourceKeys}[1]
			)`,
		),
		check(
			"content_pack_tag_evidence_source_url_check",
			sql`btrim(${table.sourceUrl}) <> '' and ${table.sourceUrl} ~ '^https?://'`,
		),
	],
);

export const contentPackUnitTagEvidence = pgTable(
	"content_pack_unit_tag_evidence",
	{
		importId: uuid().notNull(),
		sourceFingerprint: text().notNull(),
		unitId: uuid().notNull(),
		tagId: uuid().notNull(),
		profileId: uuid().notNull(),
		unitSourceKey: text().notNull(),
		tagSourceKey: text().notNull(),
		sourceFitVote: integer().notNull(),
		sourceSpoilerLevel: smallint(),
		sourceUrl: text().notNull(),
		sourceImportedAt: createTimestampMsColumn().notNull(),
		sourceAggregate: createJsonObjectColumn<ImportedSourceAggregate>(),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		primaryKey({
			name: "content_pack_unit_tag_evidence_pkey",
			columns: [table.importId, table.sourceFingerprint],
		}),
		foreignKey({
			columns: [table.importId, table.profileId],
			foreignColumns: [contentPackImport.id, contentPackImport.importerProfileId],
			name: "content_pack_unit_tag_evidence_import_profile_fkey",
		})
			.onUpdate("cascade")
			.onDelete("cascade"),
		foreignKey({
			columns: [table.unitId, table.tagId, table.profileId],
			foreignColumns: [unitTagJudgment.unitId, unitTagJudgment.tagId, unitTagJudgment.profileId],
			name: "content_pack_unit_tag_evidence_judgment_fkey",
		})
			.onUpdate("cascade")
			.onDelete("restrict"),
		index("content_pack_unit_tag_evidence_judgment_idx").on(
			table.unitId,
			table.tagId,
			table.profileId,
			table.importId,
		),
		check(
			"content_pack_unit_tag_evidence_source_fingerprint_check",
			sql`${table.sourceFingerprint} ~ '^[0-9a-f]{64}$'`,
		),
		check(
			"content_pack_unit_tag_evidence_source_keys_check",
			sql`btrim(${table.unitSourceKey}) <> '' and btrim(${table.tagSourceKey}) <> ''`,
		),
		check("content_pack_unit_tag_evidence_fit_vote_check", sql`${table.sourceFitVote} in (-1, 1)`),
		check(
			"content_pack_unit_tag_evidence_spoiler_level_check",
			sql`${table.sourceSpoilerLevel} is null or ${table.sourceSpoilerLevel} between 0 and 2`,
		),
		check(
			"content_pack_unit_tag_evidence_source_url_check",
			sql`btrim(${table.sourceUrl}) <> '' and ${table.sourceUrl} ~ '^https?://'`,
		),
		createJsonObjectConstraint(
			"content_pack_unit_tag_evidence_source_aggregate_check",
			table.sourceAggregate,
		),
	],
);

/** Source evidence for a measurement fact created or confirmed by one pack import. */
export const contentPackEntityMeasurementEvidence = pgTable(
	"content_pack_entity_measurement_evidence",
	{
		importId: uuid()
			.notNull()
			.references(() => contentPackImport.id, { onDelete: "cascade" }),
		sourceFingerprint: text().notNull(),
		measurementId: uuid()
			.notNull()
			.references(() => entityMeasurement.id, { onDelete: "restrict" }),
		entitySourceKey: text().notNull(),
		contextUnitSourceKey: text(),
		sourceUrl: text().notNull(),
		sourceObservedAt: createTimestampMsColumn().notNull(),
		provenance: createJsonObjectColumn().notNull(),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		primaryKey({
			name: "content_pack_entity_measurement_evidence_pkey",
			columns: [table.importId, table.sourceFingerprint],
		}),
		index("content_pack_entity_measurement_evidence_measurement_idx").on(
			table.measurementId,
			table.importId,
		),
		check(
			"content_pack_entity_measurement_evidence_fingerprint_check",
			sql`${table.sourceFingerprint} ~ '^[0-9a-f]{64}$'`,
		),
		check(
			"content_pack_entity_measurement_evidence_source_key_check",
			sql`btrim(${table.entitySourceKey}) <> '' and (${table.contextUnitSourceKey} is null or btrim(${table.contextUnitSourceKey}) <> '')`,
		),
		check(
			"content_pack_entity_measurement_evidence_url_check",
			sql`btrim(${table.sourceUrl}) <> '' and ${table.sourceUrl} ~ '^https?://'`,
		),
		createJsonObjectConstraint(
			"content_pack_entity_measurement_evidence_provenance_check",
			table.provenance,
		),
	],
);

export const contentPackGuideNodeEvidence = pgTable(
	"content_pack_guide_node_evidence",
	{
		importId: uuid().notNull(),
		sourceFingerprint: text().notNull(),
		nodeId: uuid()
			.notNull()
			.references(() => guideNode.id, { onDelete: "restrict" }),
		nodeSourceKey: text().notNull(),
		sourceUrl: text().notNull(),
		sourceImportedAt: createTimestampMsColumn().notNull(),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.importId, table.sourceFingerprint] }),
		foreignKey({
			columns: [table.importId],
			foreignColumns: [contentPackImport.id],
			name: "content_pack_guide_node_evidence_import_fkey",
		}).onDelete("cascade"),
		index("content_pack_guide_node_evidence_node_idx").on(table.nodeId, table.importId),
		check(
			"content_pack_guide_node_evidence_fingerprint_check",
			sql`${table.sourceFingerprint} ~ '^[0-9a-f]{64}$'`,
		),
		check(
			"content_pack_guide_node_evidence_source_key_check",
			sql`btrim(${table.nodeSourceKey}) <> ''`,
		),
	],
);

export const contentPackTagRelationEvidence = pgTable(
	"content_pack_tag_relation_evidence",
	{
		importId: uuid().notNull(),
		sourceFingerprint: text().notNull(),
		relationId: uuid()
			.notNull()
			.references(() => tagRelation.id, { onDelete: "restrict" }),
		relationSourceKey: text().notNull(),
		sourceUrl: text().notNull(),
		sourceImportedAt: createTimestampMsColumn().notNull(),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.importId, table.sourceFingerprint] }),
		foreignKey({
			columns: [table.importId],
			foreignColumns: [contentPackImport.id],
			name: "content_pack_tag_relation_evidence_import_fkey",
		}).onDelete("cascade"),
		index("content_pack_tag_relation_evidence_relation_idx").on(table.relationId, table.importId),
		check(
			"content_pack_tag_relation_evidence_fingerprint_check",
			sql`${table.sourceFingerprint} ~ '^[0-9a-f]{64}$'`,
		),
		check(
			"content_pack_tag_relation_evidence_source_key_check",
			sql`btrim(${table.relationSourceKey}) <> ''`,
		),
	],
);

export const contentPackTagExpressionEvidence = pgTable(
	"content_pack_tag_expression_evidence",
	{
		importId: uuid().notNull(),
		sourceFingerprint: text().notNull(),
		expressionId: uuid()
			.notNull()
			.references(() => tagExpression.id, { onDelete: "restrict" }),
		declaredExpressionId: uuid().notNull(),
		expressionSourceKey: text().notNull(),
		canonicalClaimKey: text().notNull(),
		sourceUrl: text().notNull(),
		sourceImportedAt: createTimestampMsColumn().notNull(),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.importId, table.sourceFingerprint] }),
		foreignKey({
			columns: [table.importId],
			foreignColumns: [contentPackImport.id],
			name: "content_pack_tag_expression_evidence_import_fkey",
		}).onDelete("cascade"),
		index("content_pack_tag_expression_evidence_expression_idx").on(
			table.expressionId,
			table.importId,
		),
		check(
			"content_pack_tag_expression_evidence_fingerprint_check",
			sql`${table.sourceFingerprint} ~ '^[0-9a-f]{64}$'`,
		),
		check(
			"content_pack_tag_expression_evidence_source_key_check",
			sql`btrim(${table.expressionSourceKey}) <> '' and btrim(${table.canonicalClaimKey}) <> ''`,
		),
	],
);

export const contentPackTagPathDefinitionEvidence = pgTable(
	"content_pack_tag_path_definition_evidence",
	{
		importId: uuid().notNull(),
		sourceFingerprint: text().notNull(),
		pathId: uuid().notNull(),
		profileId: uuid().notNull(),
		declaredPathId: uuid().notNull(),
		pathSourceKey: text().notNull(),
		memberNodeSourceKeys: text().array().notNull(),
		relationSourceKeys: text().array().notNull(),
		sourceVote: integer().notNull(),
		sourceUrl: text().notNull(),
		sourceImportedAt: createTimestampMsColumn().notNull(),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		primaryKey({
			name: "content_pack_tag_path_definition_evidence_pkey",
			columns: [table.importId, table.sourceFingerprint],
		}),
		foreignKey({
			columns: [table.importId, table.profileId],
			foreignColumns: [contentPackImport.id, contentPackImport.importerProfileId],
			name: "content_pack_tag_path_definition_evidence_import_profile_fkey",
		})
			.onUpdate("cascade")
			.onDelete("cascade"),
		foreignKey({
			columns: [table.pathId, table.profileId],
			foreignColumns: [tagPathVote.pathId, tagPathVote.profileId],
			name: "content_pack_tag_path_definition_evidence_vote_fkey",
		})
			.onUpdate("cascade")
			.onDelete("restrict"),
		index("content_pack_tag_path_definition_evidence_vote_idx").on(
			table.pathId,
			table.profileId,
			table.importId,
		),
		check(
			"content_pack_tag_path_definition_evidence_source_fingerprint_check",
			sql`${table.sourceFingerprint} ~ '^[0-9a-f]{64}$'`,
		),
		check(
			"content_pack_tag_path_definition_evidence_source_key_check",
			sql`btrim(${table.pathSourceKey}) <> ''`,
		),
		check(
			"content_pack_tag_path_definition_evidence_member_count_check",
			sql`cardinality(${table.memberNodeSourceKeys}) between 2 and 16`,
		),
		check(
			"content_pack_tag_path_definition_evidence_member_null_check",
			sql`array_position(${table.memberNodeSourceKeys}, null) is null`,
		),
		check(
			"content_pack_tag_path_definition_evidence_relation_check",
			sql`cardinality(${table.relationSourceKeys}) = cardinality(${table.memberNodeSourceKeys}) - 1
				and array_position(${table.relationSourceKeys}, null) is null`,
		),
		check("content_pack_tag_path_definition_evidence_vote_check", sql`${table.sourceVote} = 1`),
		check(
			"content_pack_tag_path_definition_evidence_source_url_check",
			sql`btrim(${table.sourceUrl}) <> '' and ${table.sourceUrl} ~ '^https?://'`,
		),
	],
);

export const contentPackTagPathSenseEvidence = pgTable(
	"content_pack_tag_path_sense_evidence",
	{
		importId: uuid().notNull(),
		sourceFingerprint: text().notNull(),
		senseId: uuid()
			.notNull()
			.references(() => tagPathSense.id, { onDelete: "restrict" }),
		declaredSenseId: uuid().notNull(),
		senseSourceKey: text().notNull(),
		pathSourceKey: text().notNull(),
		expressionSourceKey: text().notNull(),
		sourceUrl: text().notNull(),
		sourceImportedAt: createTimestampMsColumn().notNull(),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.importId, table.sourceFingerprint] }),
		foreignKey({
			columns: [table.importId],
			foreignColumns: [contentPackImport.id],
			name: "content_pack_tag_path_sense_evidence_import_fkey",
		}).onDelete("cascade"),
		index("content_pack_tag_path_sense_evidence_sense_idx").on(table.senseId, table.importId),
		check(
			"content_pack_tag_path_sense_evidence_fingerprint_check",
			sql`${table.sourceFingerprint} ~ '^[0-9a-f]{64}$'`,
		),
		check(
			"content_pack_tag_path_sense_evidence_source_keys_check",
			sql`btrim(${table.senseSourceKey}) <> ''
				and btrim(${table.pathSourceKey}) <> ''
				and btrim(${table.expressionSourceKey}) <> ''`,
		),
	],
);

export const contentPackUnitTagPathApplicationEvidence = pgTable(
	"content_pack_unit_tag_path_application_evidence",
	{
		importId: uuid().notNull(),
		sourceFingerprint: text().notNull(),
		applicationId: uuid().notNull(),
		unitId: uuid().notNull(),
		senseId: uuid().notNull(),
		profileId: uuid().notNull(),
		unitSourceKey: text().notNull(),
		senseSourceKey: text().notNull(),
		declaredSenseId: uuid().notNull(),
		sourceFitVote: integer().notNull(),
		sourceSpoilerLevel: smallint(),
		sourceUrl: text().notNull(),
		sourceImportedAt: createTimestampMsColumn().notNull(),
		sourceAggregate: createJsonObjectColumn<ImportedSourceAggregate>(),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		primaryKey({
			name: "content_pack_unit_tag_path_application_evidence_pkey",
			columns: [table.importId, table.sourceFingerprint],
		}),
		foreignKey({
			columns: [table.importId, table.profileId],
			foreignColumns: [contentPackImport.id, contentPackImport.importerProfileId],
			name: "content_pack_unit_tag_path_application_evidence_import_profile_fkey",
		})
			.onUpdate("cascade")
			.onDelete("cascade"),
		foreignKey({
			columns: [table.applicationId, table.profileId],
			foreignColumns: [
				unitTagPathApplicationJudgment.applicationId,
				unitTagPathApplicationJudgment.profileId,
			],
			name: "content_pack_unit_tag_path_application_evidence_judgment_fkey",
		})
			.onUpdate("cascade")
			.onDelete("restrict"),
		index("content_pack_unit_tag_path_application_evidence_judgment_idx").on(
			table.applicationId,
			table.profileId,
			table.importId,
		),
		index("content_pack_unit_tag_path_application_evidence_source_idx").on(
			table.unitId,
			table.senseId,
			table.importId,
		),
		check(
			"content_pack_unit_tag_path_application_evidence_source_fingerprint_check",
			sql`${table.sourceFingerprint} ~ '^[0-9a-f]{64}$'`,
		),
		check(
			"content_pack_unit_tag_path_application_evidence_source_keys_check",
			sql`btrim(${table.unitSourceKey}) <> '' and btrim(${table.senseSourceKey}) <> ''`,
		),
		check(
			"content_pack_unit_tag_path_application_evidence_fit_vote_check",
			sql`${table.sourceFitVote} in (-1, 1)`,
		),
		check(
			"content_pack_unit_tag_path_application_evidence_spoiler_level_check",
			sql`${table.sourceSpoilerLevel} is null or ${table.sourceSpoilerLevel} between 0 and 2`,
		),
		check(
			"content_pack_unit_tag_path_application_evidence_source_url_check",
			sql`btrim(${table.sourceUrl}) <> '' and ${table.sourceUrl} ~ '^https?://'`,
		),
		createJsonObjectConstraint(
			"content_pack_unit_tag_path_application_evidence_source_aggregate_check",
			table.sourceAggregate,
		),
	],
);

export const contentPackSubjectAssociationEvidence = pgTable(
	"content_pack_subject_association_evidence",
	{
		importId: uuid().notNull(),
		sourceFingerprint: text().notNull(),
		associationId: uuid().notNull(),
		profileId: uuid().notNull(),
		declaredAssociationId: uuid().notNull(),
		subjectSourceKey: text().notNull(),
		sourceSpoilerLevel: smallint().notNull(),
		sourceUrl: text().notNull(),
		sourceImportedAt: createTimestampMsColumn().notNull(),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		primaryKey({
			name: "content_pack_subject_association_evidence_pkey",
			columns: [table.importId, table.sourceFingerprint],
		}),
		foreignKey({
			columns: [table.importId, table.profileId],
			foreignColumns: [contentPackImport.id, contentPackImport.importerProfileId],
			name: "content_pack_subject_association_evidence_import_profile_fkey",
		})
			.onUpdate("cascade")
			.onDelete("cascade"),
		foreignKey({
			columns: [table.associationId, table.profileId],
			foreignColumns: [
				subjectAssociationJudgment.associationId,
				subjectAssociationJudgment.profileId,
			],
			name: "content_pack_subject_association_evidence_judgment_fkey",
		})
			.onUpdate("cascade")
			.onDelete("restrict"),
		index("content_pack_subject_association_evidence_judgment_idx").on(
			table.associationId,
			table.profileId,
			table.importId,
		),
		check(
			"content_pack_subject_association_evidence_source_fingerprint_check",
			sql`${table.sourceFingerprint} ~ '^[0-9a-f]{64}$'`,
		),
		check(
			"content_pack_subject_association_evidence_source_key_check",
			sql`btrim(${table.subjectSourceKey}) <> ''`,
		),
		check(
			"content_pack_subject_association_evidence_spoiler_level_check",
			sql`${table.sourceSpoilerLevel} between 0 and 2`,
		),
		check(
			"content_pack_subject_association_evidence_source_url_check",
			sql`btrim(${table.sourceUrl}) <> '' and ${table.sourceUrl} ~ '^https?://'`,
		),
	],
);
