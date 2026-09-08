import { sql, inArray } from "drizzle-orm";
import {
	bigint,
	boolean,
	check,
	foreignKey,
	index,
	integer,
	jsonb,
	pgEnum,
	primaryKey,
	smallint,
	text,
	unique,
	uuid,
} from "drizzle-orm/pg-core";
import { CatalogOwnerValues, type CatalogOwner } from "@rezics/reference";
import { pgTable } from "./base";
import { users } from "./auth";
import { entityIdentity } from "./catalog-identity";
import { CatalogNameTables } from "./catalog-names";
import { CatalogFactTables } from "./catalog-facts";
import { catalogSourceBindingRevision } from "./catalog-source";
import { governanceDecision } from "./governance";
import { unitReferenceColumns, unitReferenceConstraints } from "./unit-reference-columns";
import {
	createCreatedAtColumn,
	createTimestampMsColumn,
	createUpdatedAtColumn,
	createUuidv7PrimaryKey,
} from "./columns";
import {
	UnitMergeRequestStateValues,
	UnitMergeReviewDecisionValues,
	UnitMergeOperationStateValues,
	UnitMergeOperationPhaseValues,
	UnitMergeItemKindValues,
	UnitMergeItemStateValues,
	type UnitMergeReconciliationPlan,
	toEnumValues,
} from "./contract-values";
import type { ParticipationAuthority } from "../../participation/policy";
export const unitMergeRequestState = pgEnum(
	"unit_merge_request_state",
	toEnumValues(UnitMergeRequestStateValues),
);
export const unitMergeReviewDecision = pgEnum(
	"unit_merge_review_decision",
	toEnumValues(UnitMergeReviewDecisionValues),
);
export const unitMergeOperationState = pgEnum(
	"unit_merge_operation_state",
	toEnumValues(UnitMergeOperationStateValues),
);
export const unitMergeOperationPhase = pgEnum(
	"unit_merge_operation_phase",
	toEnumValues(UnitMergeOperationPhaseValues),
);

/** Immutable reviewed intent over two actual native identities; no Variant graph or history rewrite. */
export const unitMergeRequest = pgTable(
	"unit_merge_request",
	{
		id: createUuidv7PrimaryKey(),
		sourceUnitId: uuid().notNull(),
		targetUnitId: uuid().notNull(),
		owner: text().$type<CatalogOwner>().notNull(),
		shape: text().notNull(),
		sourceRevision: bigint({ mode: "number" }).notNull(),
		targetRevision: bigint({ mode: "number" }).notNull(),
		sourceUpdatedAt: createTimestampMsColumn().notNull(),
		targetUpdatedAt: createTimestampMsColumn().notNull(),
		statusAtRequest: text().$type<"draft" | "published" | "archived">().notNull(),
		visibilityAtRequest: text().$type<"public" | "unlisted" | "private">().notNull(),
		sourceTitle: text(),
		targetTitle: text(),
		proposerProfileId: uuid()
			.notNull()
			.references(() => entityIdentity.id, { onDelete: "restrict" }),
		proposerAuthUserId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		proposerAuthority: jsonb().$type<ParticipationAuthority>().notNull(),
		idempotencyKey: text().notNull(),
		decisionId: uuid()
			.notNull()
			.references(() => governanceDecision.id, { onDelete: "restrict" }),
		requestFingerprint: text().notNull(),
		plan: jsonb().$type<UnitMergeReconciliationPlan>().notNull(),
		note: text(),
		policyVersion: smallint().notNull().default(1),
		requiredApprovals: smallint().notNull().default(2),
		vetoEnabled: boolean().notNull().default(true),
		selfReviewForbidden: boolean().notNull().default(true),
		state: unitMergeRequestState().notNull().default("pending_review"),
		expiresAt: createTimestampMsColumn().notNull(),
		acceptedAt: createTimestampMsColumn(),
		canonicalizedAt: createTimestampMsColumn(),
		completedAt: createTimestampMsColumn(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
		...unitReferenceColumns("sourceUnit", "restrict"),
		...unitReferenceColumns("targetUnit", "restrict"),
	},
	(table) => [
		...unitReferenceConstraints(
			"unit_merge_request",
			"sourceUnit",
			table,
			false,
			table.sourceUnitId,
		),
		...unitReferenceConstraints(
			"unit_merge_request",
			"targetUnit",
			table,
			false,
			table.targetUnitId,
		),
		unique("unit_merge_request_pair_key").on(
			table.id,
			table.owner,
			table.sourceUnitId,
			table.targetUnitId,
		),
		unique("unit_merge_request_actor_idempotency_key").on(
			table.proposerAuthUserId,
			table.idempotencyKey,
		),
		index("unit_merge_request_state_page_idx").on(table.state, table.id),
		index("unit_merge_request_source_idx").on(table.sourceUnitId, table.id),
		index("unit_merge_request_target_idx").on(table.targetUnitId, table.id),
		index("unit_merge_request_expiry_idx")
			.on(table.expiresAt, table.id)
			.where(sql`${table.state}='pending_review'`),
		check("unit_merge_request_owner_check", inArray(table.owner, CatalogOwnerValues)),
		check(
			"unit_merge_request_native_pair_check",
			sql`coalesce((case ${table.owner} when 'publishing' then ${table.sourceUnitPublishingId} when 'music' then ${table.sourceUnitMusicId} when 'program' then ${table.sourceUnitProgramId} when 'software' then ${table.sourceUnitSoftwareId} when 'entity' then ${table.sourceUnitEntityId} when 'grouping' then ${table.sourceUnitGroupingId} when 'reference' then ${table.sourceUnitReferenceId} when 'distribution' then ${table.sourceUnitDistributionId} end)=${table.sourceUnitId} and (case ${table.owner} when 'publishing' then ${table.targetUnitPublishingId} when 'music' then ${table.targetUnitMusicId} when 'program' then ${table.targetUnitProgramId} when 'software' then ${table.targetUnitSoftwareId} when 'entity' then ${table.targetUnitEntityId} when 'grouping' then ${table.targetUnitGroupingId} when 'reference' then ${table.targetUnitReferenceId} when 'distribution' then ${table.targetUnitDistributionId} end)=${table.targetUnitId},false)`,
		),
		check("unit_merge_request_not_self_check", sql`${table.sourceUnitId}<>${table.targetUnitId}`),
		check(
			"unit_merge_request_revision_check",
			sql`${table.sourceRevision} between 1 and 9007199254740991 and ${table.targetRevision} between 1 and 9007199254740991`,
		),
		check("unit_merge_request_shape_check", sql`${table.shape}~'^[a-z][a-z0-9_.-]{0,95}$'`),
		check(
			"unit_merge_request_lifecycle_check",
			sql`${table.statusAtRequest} in ('draft','published','archived') and ${table.visibilityAtRequest} in ('public','unlisted','private')`,
		),
		check(
			"unit_merge_request_review_policy_check",
			sql`${table.policyVersion}=1 and ${table.requiredApprovals}=2 and ${table.vetoEnabled} and ${table.selfReviewForbidden}`,
		),
		check(
			"unit_merge_request_fingerprint_check",
			sql`${table.requestFingerprint}~'^[a-f0-9]{64}$'`,
		),
		check(
			"unit_merge_request_size_check",
			sql`octet_length(${table.idempotencyKey}) between 1 and 200 and (${table.note} is null or octet_length(${table.note})<=8000) and (${table.sourceTitle} is null or char_length(${table.sourceTitle})<=500) and (${table.targetTitle} is null or char_length(${table.targetTitle})<=500)`,
		),
		check(
			"unit_merge_request_authority_check",
			sql`jsonb_typeof(${table.proposerAuthority})='object' and octet_length(${table.proposerAuthority}::text)<=4096 and ${table.proposerAuthority}->'principal'->>'kind'='auth' and (${table.proposerAuthority}->'principal'->>'authUserId')::uuid=${table.proposerAuthUserId}`,
		),
		check(
			"unit_merge_request_plan_check",
			sql`jsonb_typeof(${table.plan})='object' and octet_length(${table.plan}::text)<=1024 and ${table.plan}->>'names' in ('copy_alternates','retain_source') and ${table.plan}->>'identifiers' in ('copy_claims','retain_source') and ${table.plan}->>'semantics'='retain_source' and ${table.plan}->>'structure'='retain_source' and ${table.plan}->>'bindings' in ('rebind_paused','pause_at_source') and ${table.plan}->>'retainedAccess'='target_readers'`,
		),
	],
);
export const unitMergeReview = pgTable(
	"unit_merge_review",
	{
		requestId: uuid()
			.notNull()
			.references(() => unitMergeRequest.id, { onDelete: "restrict" }),
		reviewerAuthUserId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		reviewerProfileId: uuid()
			.notNull()
			.references(() => entityIdentity.id, { onDelete: "restrict" }),
		decision: unitMergeReviewDecision().notNull(),
		requestFingerprint: text().notNull(),
		note: text(),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.requestId, table.reviewerAuthUserId] }),
		index("unit_merge_review_entity_idx").on(table.reviewerProfileId, table.requestId),
		check(
			"unit_merge_review_note_check",
			sql`${table.note} is null or octet_length(${table.note})<=8000`,
		),
		check("unit_merge_review_fingerprint_check", sql`${table.requestFingerprint}~'^[a-f0-9]{64}$'`),
	],
);
export const unitMergeOperation = pgTable(
	"unit_merge_operation",
	{
		id: createUuidv7PrimaryKey(),
		requestId: uuid()
			.notNull()
			.references(() => unitMergeRequest.id, { onDelete: "restrict" }),
		sourceUnitId: uuid().notNull(),
		targetUnitId: uuid().notNull(),
		owner: text().$type<CatalogOwner>().notNull(),
		shard: smallint().notNull(),
		state: unitMergeOperationState().notNull().default("pending"),
		phase: unitMergeOperationPhase().notNull().default("canonicalize"),
		cursorId: uuid(),
		cursorSecondaryId: uuid(),
		executorAuthUserId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		executorProfileId: uuid()
			.notNull()
			.references(() => entityIdentity.id, { onDelete: "restrict" }),
		executorAuthority: jsonb().$type<ParticipationAuthority>().notNull(),
		attemptCount: integer().notNull().default(0),
		processedRows: bigint({ mode: "number" }).notNull().default(0),
		totalItems: bigint({ mode: "number" }).notNull().default(0),
		resolvedItems: bigint({ mode: "number" }).notNull().default(0),
		availableAt: createTimestampMsColumn().defaultNow().notNull(),
		leaseToken: uuid(),
		leaseExpiresAt: createTimestampMsColumn(),
		lastErrorCode: text(),
		lastErrorMessage: text(),
		startedAt: createTimestampMsColumn(),
		completedAt: createTimestampMsColumn(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		unique("unit_merge_operation_request_key").on(table.requestId),
		foreignKey({
			name: "unit_merge_operation_pair_fk",
			columns: [table.requestId, table.owner, table.sourceUnitId, table.targetUnitId],
			foreignColumns: [
				unitMergeRequest.id,
				unitMergeRequest.owner,
				unitMergeRequest.sourceUnitId,
				unitMergeRequest.targetUnitId,
			],
		}).onDelete("restrict"),
		index("unit_merge_operation_claim_idx")
			.on(table.shard, table.availableAt, table.id)
			.where(sql`${table.state} in ('pending','retry_wait')`),
		index("unit_merge_operation_expired_idx")
			.on(table.shard, table.leaseExpiresAt, table.id)
			.where(sql`${table.state}='processing'`),
		check("unit_merge_operation_shard_check", sql`${table.shard} between 0 and 63`),
		check(
			"unit_merge_operation_counters_check",
			sql`${table.processedRows} between 0 and 9007199254740991 and ${table.totalItems} between 0 and 9007199254740991 and ${table.resolvedItems} between 0 and ${table.totalItems} and ${table.attemptCount}>=0`,
		),
		check(
			"unit_merge_operation_lease_check",
			sql`(${table.state}='processing')=(${table.leaseToken} is not null and ${table.leaseExpiresAt} is not null)`,
		),
		check(
			"unit_merge_operation_error_check",
			sql`(${table.lastErrorCode} is null)=(${table.lastErrorMessage} is null) and (${table.lastErrorMessage} is null or octet_length(${table.lastErrorMessage})<=2048)`,
		),
		check(
			"unit_merge_operation_authority_check",
			sql`jsonb_typeof(${table.executorAuthority})='object' and octet_length(${table.executorAuthority}::text)<=4096 and ${table.executorAuthority}->'principal'->>'kind'='auth' and (${table.executorAuthority}->'principal'->>'authUserId')::uuid=${table.executorAuthUserId}`,
		),
	],
);
/** One merge per source/target pair at a time; only source data is frozen by the canonical guard. */
export const unitMergeGraphLock = pgTable(
	"unit_merge_graph_lock",
	{
		unitId: uuid().primaryKey(),
		operationId: uuid()
			.notNull()
			.references(() => unitMergeOperation.id, { onDelete: "restrict" }),
		createdAt: createCreatedAtColumn(),
		...unitReferenceColumns("unit", "restrict"),
	},
	(table) => [
		...unitReferenceConstraints("unit_merge_graph_lock", "unit", table, false, table.unitId),
		index("unit_merge_graph_lock_operation_idx").on(table.operationId, table.unitId),
	],
);
export const unitMergeRedirect = pgTable(
	"unit_merge_redirect",
	{
		sourceUnitId: uuid().primaryKey(),
		targetUnitId: uuid().notNull(),
		owner: text().$type<CatalogOwner>().notNull(),
		requestId: uuid()
			.notNull()
			.references(() => unitMergeRequest.id, { onDelete: "restrict" }),
		maxDepth: smallint().notNull().default(1),
		sourceWasPublic: boolean().notNull(),
		createdAt: createCreatedAtColumn(),
		...unitReferenceColumns("sourceUnit", "restrict"),
		...unitReferenceColumns("targetUnit", "restrict"),
	},
	(table) => [
		...unitReferenceConstraints(
			"unit_merge_redirect",
			"sourceUnit",
			table,
			false,
			table.sourceUnitId,
		),
		...unitReferenceConstraints(
			"unit_merge_redirect",
			"targetUnit",
			table,
			false,
			table.targetUnitId,
		),
		foreignKey({
			name: "unit_merge_redirect_pair_fk",
			columns: [table.requestId, table.owner, table.sourceUnitId, table.targetUnitId],
			foreignColumns: [
				unitMergeRequest.id,
				unitMergeRequest.owner,
				unitMergeRequest.sourceUnitId,
				unitMergeRequest.targetUnitId,
			],
		}).onDelete("restrict"),
		unique("unit_merge_redirect_request_key").on(table.requestId),
		index("unit_merge_redirect_target_depth_idx").on(
			table.targetUnitId,
			table.maxDepth.desc(),
			table.sourceUnitId,
		),
		check("unit_merge_redirect_depth_check", sql`${table.maxDepth} between 1 and 32`),
	],
);
/** Every retained/copied claim keeps exact original native history references; receipts never rewrite source history. */
export const unitMergeReconciliationItem = pgTable(
	"unit_merge_reconciliation_item",
	{
		requestId: uuid().notNull(),
		id: uuid().default(sql`uuidv7()`).notNull(),
		owner: text().$type<CatalogOwner>().notNull(),
		sourceUnitId: uuid().notNull(),
		targetUnitId: uuid().notNull(),
		sourceOwnerRevision: bigint({ mode: "number" }).notNull(),
		targetOwnerRevision: bigint({ mode: "number" }),
		kind: text().$type<(typeof UnitMergeItemKindValues)[number]>().notNull(),
		sourceKey: text().notNull(),
		state: text().$type<(typeof UnitMergeItemStateValues)[number]>().notNull().default("pending"),
		decision: text(),
		sourceNameId: uuid(),
		sourceNameRevision: bigint({ mode: "number" }),
		targetNameId: uuid(),
		targetNameRevision: bigint({ mode: "number" }),
		sourceIdentifierId: uuid(),
		sourceIdentifierRevision: bigint({ mode: "number" }),
		targetIdentifierId: uuid(),
		targetIdentifierRevision: bigint({ mode: "number" }),
		sourceSemanticId: uuid(),
		sourceSemanticVersion: bigint({ mode: "number" }),
		sourceRecordId: uuid(),
		mappingKey: uuid(),
		sourceBindingRevision: bigint({ mode: "number" }),
		targetBindingRevision: bigint({ mode: "number" }),
		errorCode: text(),
		resolvedByAuthUserId: uuid().references(() => users.id, { onDelete: "restrict" }),
		resolvedAt: createTimestampMsColumn(),
		createdAt: createCreatedAtColumn(),
		sourcePublishingOwnerId: uuid().generatedAlwaysAs(
			sql`case when owner='publishing' then source_unit_id end`,
		),
		sourceMusicOwnerId: uuid().generatedAlwaysAs(
			sql`case when owner='music' then source_unit_id end`,
		),
		sourceProgramOwnerId: uuid().generatedAlwaysAs(
			sql`case when owner='program' then source_unit_id end`,
		),
		sourceSoftwareOwnerId: uuid().generatedAlwaysAs(
			sql`case when owner='software' then source_unit_id end`,
		),
		sourceEntityOwnerId: uuid().generatedAlwaysAs(
			sql`case when owner='entity' then source_unit_id end`,
		),
		sourceGroupingOwnerId: uuid().generatedAlwaysAs(
			sql`case when owner='grouping' then source_unit_id end`,
		),
		sourceReferenceOwnerId: uuid().generatedAlwaysAs(
			sql`case when owner='reference' then source_unit_id end`,
		),
		sourceDistributionOwnerId: uuid().generatedAlwaysAs(
			sql`case when owner='distribution' then source_unit_id end`,
		),
		targetPublishingOwnerId: uuid().generatedAlwaysAs(
			sql`case when owner='publishing' then target_unit_id end`,
		),
		targetMusicOwnerId: uuid().generatedAlwaysAs(
			sql`case when owner='music' then target_unit_id end`,
		),
		targetProgramOwnerId: uuid().generatedAlwaysAs(
			sql`case when owner='program' then target_unit_id end`,
		),
		targetSoftwareOwnerId: uuid().generatedAlwaysAs(
			sql`case when owner='software' then target_unit_id end`,
		),
		targetEntityOwnerId: uuid().generatedAlwaysAs(
			sql`case when owner='entity' then target_unit_id end`,
		),
		targetGroupingOwnerId: uuid().generatedAlwaysAs(
			sql`case when owner='grouping' then target_unit_id end`,
		),
		targetReferenceOwnerId: uuid().generatedAlwaysAs(
			sql`case when owner='reference' then target_unit_id end`,
		),
		targetDistributionOwnerId: uuid().generatedAlwaysAs(
			sql`case when owner='distribution' then target_unit_id end`,
		),
		...unitReferenceColumns("sourceUnit", "restrict"),
		...unitReferenceColumns("targetUnit", "restrict"),
	},
	(table) => [
		...unitReferenceConstraints(
			"unit_merge_reconciliation_item",
			"sourceUnit",
			table,
			false,
			table.sourceUnitId,
		),
		...unitReferenceConstraints(
			"unit_merge_reconciliation_item",
			"targetUnit",
			table,
			false,
			table.targetUnitId,
		),
		primaryKey({ columns: [table.requestId, table.id] }),
		unique("unit_merge_item_source_key").on(table.requestId, table.kind, table.sourceKey),
		foreignKey({
			name: "unit_merge_item_request_pair_fk",
			columns: [table.requestId, table.owner, table.sourceUnitId, table.targetUnitId],
			foreignColumns: [
				unitMergeRequest.id,
				unitMergeRequest.owner,
				unitMergeRequest.sourceUnitId,
				unitMergeRequest.targetUnitId,
			],
		}).onDelete("restrict"),
		index("unit_merge_item_state_page_idx").on(table.requestId, table.state, table.id),
		index("unit_merge_item_actor_idx").on(table.resolvedByAuthUserId, table.requestId, table.id),
		check("unit_merge_item_kind_check", inArray(table.kind, UnitMergeItemKindValues)),
		check("unit_merge_item_state_check", inArray(table.state, UnitMergeItemStateValues)),
		check("unit_merge_item_key_check", sql`octet_length(${table.sourceKey}) between 1 and 256`),
		check(
			"unit_merge_item_root_revision_check",
			sql`${table.sourceOwnerRevision} between 1 and 9007199254740991 and (${table.targetOwnerRevision} is null or ${table.targetOwnerRevision} between 1 and 9007199254740991)`,
		),
		check(
			"unit_merge_item_history_shape_check",
			sql`case ${table.kind} when 'name' then ${table.sourceNameId} is not null and ${table.sourceNameRevision}>0 and num_nonnulls(${table.sourceIdentifierId},${table.sourceSemanticId},${table.sourceRecordId})=0 when 'identifier' then ${table.sourceIdentifierId} is not null and ${table.sourceIdentifierRevision}>0 and num_nonnulls(${table.sourceNameId},${table.sourceSemanticId},${table.sourceRecordId})=0 when 'semantic' then ${table.sourceSemanticId} is not null and ${table.sourceSemanticVersion}>0 and num_nonnulls(${table.sourceNameId},${table.sourceIdentifierId},${table.sourceRecordId})=0 when 'source_binding' then ${table.sourceRecordId} is not null and ${table.mappingKey} is not null and ${table.sourceBindingRevision}>0 and num_nonnulls(${table.sourceNameId},${table.sourceIdentifierId},${table.sourceSemanticId})=0 when 'structure' then num_nonnulls(${table.sourceNameId},${table.sourceIdentifierId},${table.sourceSemanticId},${table.sourceRecordId})=0 else false end`,
		),
		check(
			"unit_merge_item_target_shape_check",
			sql`num_nonnulls(${table.targetNameId},${table.targetNameRevision}) in (0,2) and num_nonnulls(${table.targetIdentifierId},${table.targetIdentifierRevision}) in (0,2)`,
		),
		check(
			"unit_merge_item_resolution_check",
			sql`(${table.state} in ('applied','retained'))=(${table.resolvedAt} is not null and ${table.resolvedByAuthUserId} is not null and ${table.decision} is not null)`,
		),
		foreignKey({
			name: "unit_merge_item_source_binding_fk",
			columns: [table.sourceRecordId, table.mappingKey, table.sourceBindingRevision],
			foreignColumns: [
				catalogSourceBindingRevision.sourceRecordId,
				catalogSourceBindingRevision.mappingKey,
				catalogSourceBindingRevision.revision,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "unit_merge_item_target_binding_fk",
			columns: [table.sourceRecordId, table.mappingKey, table.targetBindingRevision],
			foreignColumns: [
				catalogSourceBindingRevision.sourceRecordId,
				catalogSourceBindingRevision.mappingKey,
				catalogSourceBindingRevision.revision,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "publishing_merge_source_root_fk",
			columns: [table.sourcePublishingOwnerId, table.sourceOwnerRevision],
			foreignColumns: [
				CatalogFactTables.publishing.change.ownerId,
				CatalogFactTables.publishing.change.version,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "publishing_merge_source_name_fk",
			columns: [table.sourcePublishingOwnerId, table.sourceNameId, table.sourceNameRevision],
			foreignColumns: [
				CatalogNameTables.publishing.nameRevision.ownerId,
				CatalogNameTables.publishing.nameRevision.id,
				CatalogNameTables.publishing.nameRevision.revision,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "publishing_merge_source_identifier_fk",
			columns: [
				table.sourcePublishingOwnerId,
				table.sourceIdentifierId,
				table.sourceIdentifierRevision,
			],
			foreignColumns: [
				CatalogNameTables.publishing.identifierRevision.ownerId,
				CatalogNameTables.publishing.identifierRevision.id,
				CatalogNameTables.publishing.identifierRevision.revision,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "publishing_merge_target_root_fk",
			columns: [table.targetPublishingOwnerId, table.targetOwnerRevision],
			foreignColumns: [
				CatalogFactTables.publishing.change.ownerId,
				CatalogFactTables.publishing.change.version,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "publishing_merge_target_name_fk",
			columns: [table.targetPublishingOwnerId, table.targetNameId, table.targetNameRevision],
			foreignColumns: [
				CatalogNameTables.publishing.nameRevision.ownerId,
				CatalogNameTables.publishing.nameRevision.id,
				CatalogNameTables.publishing.nameRevision.revision,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "publishing_merge_target_identifier_fk",
			columns: [
				table.targetPublishingOwnerId,
				table.targetIdentifierId,
				table.targetIdentifierRevision,
			],
			foreignColumns: [
				CatalogNameTables.publishing.identifierRevision.ownerId,
				CatalogNameTables.publishing.identifierRevision.id,
				CatalogNameTables.publishing.identifierRevision.revision,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "publishing_merge_source_semantic_fk",
			columns: [table.sourcePublishingOwnerId, table.sourceSemanticId, table.sourceSemanticVersion],
			foreignColumns: [
				CatalogFactTables.publishing.semanticRevision.ownerId,
				CatalogFactTables.publishing.semanticRevision.semanticId,
				CatalogFactTables.publishing.semanticRevision.version,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "music_merge_source_root_fk",
			columns: [table.sourceMusicOwnerId, table.sourceOwnerRevision],
			foreignColumns: [
				CatalogFactTables.music.change.ownerId,
				CatalogFactTables.music.change.version,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "music_merge_source_name_fk",
			columns: [table.sourceMusicOwnerId, table.sourceNameId, table.sourceNameRevision],
			foreignColumns: [
				CatalogNameTables.music.nameRevision.ownerId,
				CatalogNameTables.music.nameRevision.id,
				CatalogNameTables.music.nameRevision.revision,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "music_merge_source_identifier_fk",
			columns: [table.sourceMusicOwnerId, table.sourceIdentifierId, table.sourceIdentifierRevision],
			foreignColumns: [
				CatalogNameTables.music.identifierRevision.ownerId,
				CatalogNameTables.music.identifierRevision.id,
				CatalogNameTables.music.identifierRevision.revision,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "music_merge_target_root_fk",
			columns: [table.targetMusicOwnerId, table.targetOwnerRevision],
			foreignColumns: [
				CatalogFactTables.music.change.ownerId,
				CatalogFactTables.music.change.version,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "music_merge_target_name_fk",
			columns: [table.targetMusicOwnerId, table.targetNameId, table.targetNameRevision],
			foreignColumns: [
				CatalogNameTables.music.nameRevision.ownerId,
				CatalogNameTables.music.nameRevision.id,
				CatalogNameTables.music.nameRevision.revision,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "music_merge_target_identifier_fk",
			columns: [table.targetMusicOwnerId, table.targetIdentifierId, table.targetIdentifierRevision],
			foreignColumns: [
				CatalogNameTables.music.identifierRevision.ownerId,
				CatalogNameTables.music.identifierRevision.id,
				CatalogNameTables.music.identifierRevision.revision,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "music_merge_source_semantic_fk",
			columns: [table.sourceMusicOwnerId, table.sourceSemanticId, table.sourceSemanticVersion],
			foreignColumns: [
				CatalogFactTables.music.semanticRevision.ownerId,
				CatalogFactTables.music.semanticRevision.semanticId,
				CatalogFactTables.music.semanticRevision.version,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "program_merge_source_root_fk",
			columns: [table.sourceProgramOwnerId, table.sourceOwnerRevision],
			foreignColumns: [
				CatalogFactTables.program.change.ownerId,
				CatalogFactTables.program.change.version,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "program_merge_source_name_fk",
			columns: [table.sourceProgramOwnerId, table.sourceNameId, table.sourceNameRevision],
			foreignColumns: [
				CatalogNameTables.program.nameRevision.ownerId,
				CatalogNameTables.program.nameRevision.id,
				CatalogNameTables.program.nameRevision.revision,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "program_merge_source_identifier_fk",
			columns: [
				table.sourceProgramOwnerId,
				table.sourceIdentifierId,
				table.sourceIdentifierRevision,
			],
			foreignColumns: [
				CatalogNameTables.program.identifierRevision.ownerId,
				CatalogNameTables.program.identifierRevision.id,
				CatalogNameTables.program.identifierRevision.revision,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "program_merge_target_root_fk",
			columns: [table.targetProgramOwnerId, table.targetOwnerRevision],
			foreignColumns: [
				CatalogFactTables.program.change.ownerId,
				CatalogFactTables.program.change.version,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "program_merge_target_name_fk",
			columns: [table.targetProgramOwnerId, table.targetNameId, table.targetNameRevision],
			foreignColumns: [
				CatalogNameTables.program.nameRevision.ownerId,
				CatalogNameTables.program.nameRevision.id,
				CatalogNameTables.program.nameRevision.revision,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "program_merge_target_identifier_fk",
			columns: [
				table.targetProgramOwnerId,
				table.targetIdentifierId,
				table.targetIdentifierRevision,
			],
			foreignColumns: [
				CatalogNameTables.program.identifierRevision.ownerId,
				CatalogNameTables.program.identifierRevision.id,
				CatalogNameTables.program.identifierRevision.revision,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "program_merge_source_semantic_fk",
			columns: [table.sourceProgramOwnerId, table.sourceSemanticId, table.sourceSemanticVersion],
			foreignColumns: [
				CatalogFactTables.program.semanticRevision.ownerId,
				CatalogFactTables.program.semanticRevision.semanticId,
				CatalogFactTables.program.semanticRevision.version,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "software_merge_source_root_fk",
			columns: [table.sourceSoftwareOwnerId, table.sourceOwnerRevision],
			foreignColumns: [
				CatalogFactTables.software.change.ownerId,
				CatalogFactTables.software.change.version,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "software_merge_source_name_fk",
			columns: [table.sourceSoftwareOwnerId, table.sourceNameId, table.sourceNameRevision],
			foreignColumns: [
				CatalogNameTables.software.nameRevision.ownerId,
				CatalogNameTables.software.nameRevision.id,
				CatalogNameTables.software.nameRevision.revision,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "software_merge_source_identifier_fk",
			columns: [
				table.sourceSoftwareOwnerId,
				table.sourceIdentifierId,
				table.sourceIdentifierRevision,
			],
			foreignColumns: [
				CatalogNameTables.software.identifierRevision.ownerId,
				CatalogNameTables.software.identifierRevision.id,
				CatalogNameTables.software.identifierRevision.revision,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "software_merge_target_root_fk",
			columns: [table.targetSoftwareOwnerId, table.targetOwnerRevision],
			foreignColumns: [
				CatalogFactTables.software.change.ownerId,
				CatalogFactTables.software.change.version,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "software_merge_target_name_fk",
			columns: [table.targetSoftwareOwnerId, table.targetNameId, table.targetNameRevision],
			foreignColumns: [
				CatalogNameTables.software.nameRevision.ownerId,
				CatalogNameTables.software.nameRevision.id,
				CatalogNameTables.software.nameRevision.revision,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "software_merge_target_identifier_fk",
			columns: [
				table.targetSoftwareOwnerId,
				table.targetIdentifierId,
				table.targetIdentifierRevision,
			],
			foreignColumns: [
				CatalogNameTables.software.identifierRevision.ownerId,
				CatalogNameTables.software.identifierRevision.id,
				CatalogNameTables.software.identifierRevision.revision,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "software_merge_source_semantic_fk",
			columns: [table.sourceSoftwareOwnerId, table.sourceSemanticId, table.sourceSemanticVersion],
			foreignColumns: [
				CatalogFactTables.software.semanticRevision.ownerId,
				CatalogFactTables.software.semanticRevision.semanticId,
				CatalogFactTables.software.semanticRevision.version,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "entity_merge_source_root_fk",
			columns: [table.sourceEntityOwnerId, table.sourceOwnerRevision],
			foreignColumns: [
				CatalogFactTables.entity.change.ownerId,
				CatalogFactTables.entity.change.version,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "entity_merge_source_name_fk",
			columns: [table.sourceEntityOwnerId, table.sourceNameId, table.sourceNameRevision],
			foreignColumns: [
				CatalogNameTables.entity.nameRevision.ownerId,
				CatalogNameTables.entity.nameRevision.id,
				CatalogNameTables.entity.nameRevision.revision,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "entity_merge_source_identifier_fk",
			columns: [
				table.sourceEntityOwnerId,
				table.sourceIdentifierId,
				table.sourceIdentifierRevision,
			],
			foreignColumns: [
				CatalogNameTables.entity.identifierRevision.ownerId,
				CatalogNameTables.entity.identifierRevision.id,
				CatalogNameTables.entity.identifierRevision.revision,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "entity_merge_target_root_fk",
			columns: [table.targetEntityOwnerId, table.targetOwnerRevision],
			foreignColumns: [
				CatalogFactTables.entity.change.ownerId,
				CatalogFactTables.entity.change.version,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "entity_merge_target_name_fk",
			columns: [table.targetEntityOwnerId, table.targetNameId, table.targetNameRevision],
			foreignColumns: [
				CatalogNameTables.entity.nameRevision.ownerId,
				CatalogNameTables.entity.nameRevision.id,
				CatalogNameTables.entity.nameRevision.revision,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "entity_merge_target_identifier_fk",
			columns: [
				table.targetEntityOwnerId,
				table.targetIdentifierId,
				table.targetIdentifierRevision,
			],
			foreignColumns: [
				CatalogNameTables.entity.identifierRevision.ownerId,
				CatalogNameTables.entity.identifierRevision.id,
				CatalogNameTables.entity.identifierRevision.revision,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "entity_merge_source_semantic_fk",
			columns: [table.sourceEntityOwnerId, table.sourceSemanticId, table.sourceSemanticVersion],
			foreignColumns: [
				CatalogFactTables.entity.semanticRevision.ownerId,
				CatalogFactTables.entity.semanticRevision.semanticId,
				CatalogFactTables.entity.semanticRevision.version,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "grouping_merge_source_root_fk",
			columns: [table.sourceGroupingOwnerId, table.sourceOwnerRevision],
			foreignColumns: [
				CatalogFactTables.grouping.change.ownerId,
				CatalogFactTables.grouping.change.version,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "grouping_merge_source_name_fk",
			columns: [table.sourceGroupingOwnerId, table.sourceNameId, table.sourceNameRevision],
			foreignColumns: [
				CatalogNameTables.grouping.nameRevision.ownerId,
				CatalogNameTables.grouping.nameRevision.id,
				CatalogNameTables.grouping.nameRevision.revision,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "grouping_merge_source_identifier_fk",
			columns: [
				table.sourceGroupingOwnerId,
				table.sourceIdentifierId,
				table.sourceIdentifierRevision,
			],
			foreignColumns: [
				CatalogNameTables.grouping.identifierRevision.ownerId,
				CatalogNameTables.grouping.identifierRevision.id,
				CatalogNameTables.grouping.identifierRevision.revision,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "grouping_merge_target_root_fk",
			columns: [table.targetGroupingOwnerId, table.targetOwnerRevision],
			foreignColumns: [
				CatalogFactTables.grouping.change.ownerId,
				CatalogFactTables.grouping.change.version,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "grouping_merge_target_name_fk",
			columns: [table.targetGroupingOwnerId, table.targetNameId, table.targetNameRevision],
			foreignColumns: [
				CatalogNameTables.grouping.nameRevision.ownerId,
				CatalogNameTables.grouping.nameRevision.id,
				CatalogNameTables.grouping.nameRevision.revision,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "grouping_merge_target_identifier_fk",
			columns: [
				table.targetGroupingOwnerId,
				table.targetIdentifierId,
				table.targetIdentifierRevision,
			],
			foreignColumns: [
				CatalogNameTables.grouping.identifierRevision.ownerId,
				CatalogNameTables.grouping.identifierRevision.id,
				CatalogNameTables.grouping.identifierRevision.revision,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "grouping_merge_source_semantic_fk",
			columns: [table.sourceGroupingOwnerId, table.sourceSemanticId, table.sourceSemanticVersion],
			foreignColumns: [
				CatalogFactTables.grouping.semanticRevision.ownerId,
				CatalogFactTables.grouping.semanticRevision.semanticId,
				CatalogFactTables.grouping.semanticRevision.version,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "reference_merge_source_root_fk",
			columns: [table.sourceReferenceOwnerId, table.sourceOwnerRevision],
			foreignColumns: [
				CatalogFactTables.reference.change.ownerId,
				CatalogFactTables.reference.change.version,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "reference_merge_source_name_fk",
			columns: [table.sourceReferenceOwnerId, table.sourceNameId, table.sourceNameRevision],
			foreignColumns: [
				CatalogNameTables.reference.nameRevision.ownerId,
				CatalogNameTables.reference.nameRevision.id,
				CatalogNameTables.reference.nameRevision.revision,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "reference_merge_source_identifier_fk",
			columns: [
				table.sourceReferenceOwnerId,
				table.sourceIdentifierId,
				table.sourceIdentifierRevision,
			],
			foreignColumns: [
				CatalogNameTables.reference.identifierRevision.ownerId,
				CatalogNameTables.reference.identifierRevision.id,
				CatalogNameTables.reference.identifierRevision.revision,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "reference_merge_target_root_fk",
			columns: [table.targetReferenceOwnerId, table.targetOwnerRevision],
			foreignColumns: [
				CatalogFactTables.reference.change.ownerId,
				CatalogFactTables.reference.change.version,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "reference_merge_target_name_fk",
			columns: [table.targetReferenceOwnerId, table.targetNameId, table.targetNameRevision],
			foreignColumns: [
				CatalogNameTables.reference.nameRevision.ownerId,
				CatalogNameTables.reference.nameRevision.id,
				CatalogNameTables.reference.nameRevision.revision,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "reference_merge_target_identifier_fk",
			columns: [
				table.targetReferenceOwnerId,
				table.targetIdentifierId,
				table.targetIdentifierRevision,
			],
			foreignColumns: [
				CatalogNameTables.reference.identifierRevision.ownerId,
				CatalogNameTables.reference.identifierRevision.id,
				CatalogNameTables.reference.identifierRevision.revision,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "reference_merge_source_semantic_fk",
			columns: [table.sourceReferenceOwnerId, table.sourceSemanticId, table.sourceSemanticVersion],
			foreignColumns: [
				CatalogFactTables.reference.semanticRevision.ownerId,
				CatalogFactTables.reference.semanticRevision.semanticId,
				CatalogFactTables.reference.semanticRevision.version,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "distribution_merge_source_root_fk",
			columns: [table.sourceDistributionOwnerId, table.sourceOwnerRevision],
			foreignColumns: [
				CatalogFactTables.distribution.change.ownerId,
				CatalogFactTables.distribution.change.version,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "distribution_merge_source_name_fk",
			columns: [table.sourceDistributionOwnerId, table.sourceNameId, table.sourceNameRevision],
			foreignColumns: [
				CatalogNameTables.distribution.nameRevision.ownerId,
				CatalogNameTables.distribution.nameRevision.id,
				CatalogNameTables.distribution.nameRevision.revision,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "distribution_merge_source_identifier_fk",
			columns: [
				table.sourceDistributionOwnerId,
				table.sourceIdentifierId,
				table.sourceIdentifierRevision,
			],
			foreignColumns: [
				CatalogNameTables.distribution.identifierRevision.ownerId,
				CatalogNameTables.distribution.identifierRevision.id,
				CatalogNameTables.distribution.identifierRevision.revision,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "distribution_merge_target_root_fk",
			columns: [table.targetDistributionOwnerId, table.targetOwnerRevision],
			foreignColumns: [
				CatalogFactTables.distribution.change.ownerId,
				CatalogFactTables.distribution.change.version,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "distribution_merge_target_name_fk",
			columns: [table.targetDistributionOwnerId, table.targetNameId, table.targetNameRevision],
			foreignColumns: [
				CatalogNameTables.distribution.nameRevision.ownerId,
				CatalogNameTables.distribution.nameRevision.id,
				CatalogNameTables.distribution.nameRevision.revision,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "distribution_merge_target_identifier_fk",
			columns: [
				table.targetDistributionOwnerId,
				table.targetIdentifierId,
				table.targetIdentifierRevision,
			],
			foreignColumns: [
				CatalogNameTables.distribution.identifierRevision.ownerId,
				CatalogNameTables.distribution.identifierRevision.id,
				CatalogNameTables.distribution.identifierRevision.revision,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "distribution_merge_source_semantic_fk",
			columns: [
				table.sourceDistributionOwnerId,
				table.sourceSemanticId,
				table.sourceSemanticVersion,
			],
			foreignColumns: [
				CatalogFactTables.distribution.semanticRevision.ownerId,
				CatalogFactTables.distribution.semanticRevision.semanticId,
				CatalogFactTables.distribution.semanticRevision.version,
			],
		}).onDelete("restrict"),
	],
);
