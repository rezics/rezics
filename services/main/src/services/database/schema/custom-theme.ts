import {
	CustomThemeExecutionModeV0,
	CustomThemeExternalResourceHealthStateValues,
	type CustomThemeExternalResourceHealthState,
	CustomThemeResourceModeV0,
	CustomThemeRevisionFileRoleValues,
	type CustomThemeRevisionFileRole,
	CustomThemeRevisionStateValues,
	type CustomThemeRevisionState,
	type SubmittedCustomThemeManifestV0,
	UnitPresentationTargetContractV0,
} from "@rezics/block";
import { inArray, sql } from "drizzle-orm";
import {
	boolean,
	check,
	foreignKey,
	index,
	integer,
	primaryKey,
	text,
	unique,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import {
	createCreatedAtColumn,
	createJsonDocumentColumn,
	createJsonObjectColumn,
	createJsonObjectConstraint,
	createTimestampMsColumn,
	createUpdatedAtColumn,
	createUuidv7PrimaryKey,
} from "./columns";
import { revisionContent } from "./history";
import { profile } from "./profile";
import { unit } from "./unit";

/** Unit subtype carrying reusable Custom Theme identity and localization. */
export const customTheme = pgTable("custom_theme", {
	id: uuid()
		.primaryKey()
		.references(() => unit.id, { onDelete: "cascade" }),
	createdAt: createCreatedAtColumn(),
	updatedAt: createUpdatedAtColumn(),
});

/**
 * Immutable package identity plus mutable review and emergency-control state.
 * Manifest/package columns are protected by a database trigger owned by the
 * Custom Theme PostgreSQL contract.
 */
export const customThemeRevision = pgTable(
	"custom_theme_revision",
	{
		id: createUuidv7PrimaryKey(),
		customThemeUnitId: uuid()
			.notNull()
			.references(() => customTheme.id, { onDelete: "cascade" }),
		targetContract: text().$type<typeof UnitPresentationTargetContractV0>().notNull(),
		executionMode: text().$type<typeof CustomThemeExecutionModeV0>().notNull(),
		resourceMode: text().$type<typeof CustomThemeResourceModeV0>().notNull(),
		manifestDocument: createJsonObjectColumn<SubmittedCustomThemeManifestV0>().notNull(),
		manifestSha256: text().notNull(),
		sourceArchiveSha256: text().notNull(),
		reviewState: text().$type<CustomThemeRevisionState>().default("pending_automated").notNull(),
		approvalScope: text().$type<"host_unit">().default("host_unit").notNull(),
		approvedHostUnitId: uuid().references(() => unit.id, { onDelete: "restrict" }),
		reviewEvidence: createJsonObjectColumn(),
		reviewEvidenceSha256: text(),
		automatedReviewLeaseUntil: createTimestampMsColumn(),
		automatedReviewAttempts: integer().default(0).notNull(),
		nextAutomatedReviewAt: createTimestampMsColumn().defaultNow().notNull(),
		submittedByProfileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "restrict" }),
		reviewedByProfileId: uuid().references(() => profile.id, { onDelete: "restrict" }),
		reviewedAt: createTimestampMsColumn(),
		decisionReason: text(),
		killedByProfileId: uuid().references(() => profile.id, { onDelete: "restrict" }),
		killedAt: createTimestampMsColumn(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		unique("custom_theme_revision_id_target_key").on(table.id, table.targetContract),
		index("custom_theme_revision_theme_id_idx").on(table.customThemeUnitId, table.id),
		index("custom_theme_revision_host_approval_idx")
			.on(table.approvedHostUnitId, table.targetContract, table.id)
			.where(sql`${table.reviewState} = 'approved'`),
		index("custom_theme_revision_automated_queue_idx")
			.on(table.nextAutomatedReviewAt, table.id)
			.where(sql`${table.reviewState} in ('pending_automated', 'revalidation_required')`),
		index("custom_theme_revision_review_queue_idx")
			.on(table.id)
			.where(
				sql`${table.reviewState} in ('pending_automated', 'pending_human', 'revalidation_required')`,
			),
		index("custom_theme_revision_active_idx")
			.on(table.id)
			.where(
				sql`${table.reviewState} in ('pending_automated', 'pending_human', 'approved', 'revalidation_required')`,
			),
		check(
			"custom_theme_revision_automated_review_attempts_check",
			sql`${table.automatedReviewAttempts} >= 0`,
		),
		check(
			"custom_theme_revision_target_contract_check",
			sql`${table.targetContract} = ${UnitPresentationTargetContractV0}`,
		),
		check(
			"custom_theme_revision_execution_mode_check",
			sql`${table.executionMode} = ${CustomThemeExecutionModeV0}`,
		),
		check(
			"custom_theme_revision_resource_mode_check",
			sql`${table.resourceMode} = ${CustomThemeResourceModeV0}`,
		),
		check(
			"custom_theme_revision_review_state_check",
			inArray(table.reviewState, CustomThemeRevisionStateValues),
		),
		check("custom_theme_revision_approval_scope_check", sql`${table.approvalScope} = 'host_unit'`),
		check(
			"custom_theme_revision_manifest_sha256_check",
			sql`${table.manifestSha256} ~ '^[0-9a-f]{64}$'`,
		),
		check(
			"custom_theme_revision_source_archive_sha256_check",
			sql`${table.sourceArchiveSha256} ~ '^[0-9a-f]{64}$'`,
		),
		check(
			"custom_theme_revision_review_evidence_sha256_check",
			sql`${table.reviewEvidenceSha256} is null or ${table.reviewEvidenceSha256} ~ '^[0-9a-f]{64}$'`,
		),
		check(
			"custom_theme_revision_review_shape_check",
			sql`(
				${table.reviewState} in ('pending_automated', 'pending_human')
				and ${table.reviewedByProfileId} is null
				and ${table.reviewedAt} is null
				and ${table.approvedHostUnitId} is null
				and ${table.decisionReason} is null
			) or (
				${table.reviewState} = 'rejected'
				and ${table.reviewedByProfileId} is not null
				and ${table.reviewedAt} is not null
				and ${table.approvedHostUnitId} is null
				and ${table.decisionReason} is not null
			) or (
				${table.reviewState} in ('approved', 'killed', 'revalidation_required')
				and ${table.reviewedByProfileId} is not null
				and ${table.reviewedAt} is not null
				and ${table.approvedHostUnitId} is not null
				and ${table.reviewEvidence} is not null
				and ${table.reviewEvidenceSha256} is not null
			)`,
		),
		check(
			"custom_theme_revision_reviewer_separation_check",
			sql`${table.reviewedByProfileId} is null or ${table.reviewedByProfileId} <> ${table.submittedByProfileId}`,
		),
		check(
			"custom_theme_revision_kill_shape_check",
			sql`(${table.reviewState} = 'killed') = (${table.killedAt} is not null and ${table.killedByProfileId} is not null)`,
		),
		createJsonObjectConstraint(
			"custom_theme_revision_review_evidence_json_object_check",
			table.reviewEvidence,
		),
	],
);

/** Append-only evidence and decision history for one immutable revision. */
export const customThemeRevisionReviewEvent = pgTable(
	"custom_theme_revision_review_event",
	{
		id: createUuidv7PrimaryKey(),
		revisionId: uuid()
			.notNull()
			.references(() => customThemeRevision.id, { onDelete: "cascade" }),
		kind: text().$type<"automated" | "approve" | "reject" | "revalidation" | "kill">().notNull(),
		actorProfileId: uuid().references(() => profile.id, { onDelete: "restrict" }),
		evidence: createJsonObjectColumn().notNull(),
		evidenceSha256: text().notNull(),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		index("custom_theme_review_event_revision_idx").on(
			table.revisionId,
			table.createdAt.desc(),
			table.id.desc(),
		),
		index("custom_theme_review_event_actor_idx").on(
			table.actorProfileId,
			table.createdAt.desc(),
			table.id.desc(),
		),
		check(
			"custom_theme_review_event_kind_check",
			sql`${table.kind} in ('automated', 'approve', 'reject', 'revalidation', 'kill')`,
		),
		check(
			"custom_theme_review_event_evidence_sha256_check",
			sql`${table.evidenceSha256} ~ '^[0-9a-f]{64}$'`,
		),
		createJsonObjectConstraint(
			"custom_theme_review_event_evidence_json_object_check",
			table.evidence,
		),
	],
);

/** REZICS-hosted files supplied with one immutable external-live revision. */
export const customThemeRevisionFile = pgTable(
	"custom_theme_revision_file",
	{
		revisionId: uuid()
			.notNull()
			.references(() => customThemeRevision.id, { onDelete: "cascade" }),
		path: text().notNull(),
		role: text().$type<CustomThemeRevisionFileRole>().notNull(),
		contentType: text().notNull(),
		sha256: text().notNull(),
		byteLength: integer().notNull(),
		storageKey: text().notNull(),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.revisionId, table.path] }),
		unique("custom_theme_revision_file_storage_key_key").on(table.storageKey),
		index("custom_theme_revision_file_sha256_idx").on(table.revisionId, table.sha256),
		check(
			"custom_theme_revision_file_role_check",
			inArray(table.role, CustomThemeRevisionFileRoleValues),
		),
		check(
			"custom_theme_revision_file_path_check",
			sql`length(${table.path}) between 1 and 512
				and ${table.path} !~ '(^|/)\\.\\.?(/|$)'
				and ${table.path} !~ '[\\\\]'
				and left(${table.path}, 1) <> '/'`,
		),
		check("custom_theme_revision_file_content_type_check", sql`btrim(${table.contentType}) <> ''`),
		check("custom_theme_revision_file_sha256_check", sql`${table.sha256} ~ '^[0-9a-f]{64}$'`),
		check(
			"custom_theme_revision_file_byte_length_check",
			sql`${table.byteLength} between 0 and case
				when ${table.role} = 'source_archive' then 20971520
				else 5242880
			end`,
		),
		check("custom_theme_revision_file_storage_key_check", sql`btrim(${table.storageKey}) <> ''`),
	],
);

/** Review snapshot and bounded current health for a remote dependency graph node. */
export const customThemeRevisionExternalResource = pgTable(
	"custom_theme_revision_external_resource",
	{
		revisionId: uuid()
			.notNull()
			.references(() => customThemeRevision.id, { onDelete: "cascade" }),
		resourceKey: text().notNull(),
		role: text().notNull(),
		requestedUrl: text().notNull(),
		finalUrl: text().notNull(),
		origin: text().notNull(),
		observedSha256: text().notNull(),
		observedByteLength: integer().notNull(),
		observedContentType: text().notNull(),
		integrityMetadata: text(),
		integrityWaiverReason: text(),
		corsAllowsAnonymous: boolean().notNull(),
		observedAt: createTimestampMsColumn().notNull(),
		currentHealthState: text()
			.$type<CustomThemeExternalResourceHealthState>()
			.default("unchecked")
			.notNull(),
		lastCheckedAt: createTimestampMsColumn(),
		nextCheckAt: createTimestampMsColumn().defaultNow().notNull(),
		monitorLeaseUntil: createTimestampMsColumn(),
		monitorFailureCount: integer().default(0).notNull(),
		reviewEvidence: createJsonObjectColumn().notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.revisionId, table.resourceKey] }),
		index("custom_theme_external_resource_monitor_idx").on(
			table.nextCheckAt,
			table.revisionId,
			table.resourceKey,
		),
		index("custom_theme_external_resource_origin_idx").on(
			table.origin,
			table.revisionId,
			table.resourceKey,
		),
		index("custom_theme_external_resource_unpinned_idx")
			.on(table.revisionId, table.resourceKey)
			.where(sql`${table.integrityMetadata} is null`),
		check(
			"custom_theme_external_resource_key_check",
			sql`length(${table.resourceKey}) between 1 and 200`,
		),
		check(
			"custom_theme_external_resource_urls_check",
			sql`${table.requestedUrl} like 'https://%' and ${table.finalUrl} like 'https://%' and ${table.origin} like 'https://%'`,
		),
		check(
			"custom_theme_external_resource_sha256_check",
			sql`${table.observedSha256} ~ '^[0-9a-f]{64}$'`,
		),
		check(
			"custom_theme_external_resource_byte_length_check",
			sql`${table.observedByteLength} between 0 and 5242880`,
		),
		check(
			"custom_theme_external_resource_integrity_check",
			sql`(
				${table.integrityMetadata} is not null
				and btrim(${table.integrityMetadata}) <> ''
				and ${table.integrityWaiverReason} is null
			) or (
				${table.integrityMetadata} is null
				and ${table.integrityWaiverReason} is not null
				and btrim(${table.integrityWaiverReason}) <> ''
			)`,
		),
		check(
			"custom_theme_external_resource_health_check",
			inArray(table.currentHealthState, CustomThemeExternalResourceHealthStateValues),
		),
		check(
			"custom_theme_external_resource_monitor_failure_count_check",
			sql`${table.monitorFailureCount} >= 0`,
		),
		createJsonObjectConstraint(
			"custom_theme_external_resource_review_evidence_json_object_check",
			table.reviewEvidence,
		),
	],
);

/** Exact-revision installation for one top-level host and registered target. */
export const unitCustomThemeInstallation = pgTable(
	"unit_custom_theme_installation",
	{
		hostUnitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		targetContract: text().$type<typeof UnitPresentationTargetContractV0>().notNull(),
		revisionId: uuid().notNull(),
		installedByProfileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "restrict" }),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.hostUnitId, table.targetContract] }),
		foreignKey({
			columns: [table.revisionId, table.targetContract],
			foreignColumns: [customThemeRevision.id, customThemeRevision.targetContract],
			name: "unit_custom_theme_installation_revision_target_fkey",
		}).onDelete("restrict"),
		index("unit_custom_theme_installation_revision_idx").on(table.revisionId, table.hostUnitId),
		index("unit_custom_theme_installation_installed_by_idx").on(table.installedByProfileId),
		check(
			"unit_custom_theme_installation_target_check",
			sql`${table.targetContract} = ${UnitPresentationTargetContractV0}`,
		),
	],
);

/** Sparse Unit-owned semantic header/footer document for a registered target. */
export const unitPresentationDocument = pgTable(
	"unit_presentation_document",
	{
		hostUnitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		targetContract: text().$type<typeof UnitPresentationTargetContractV0>().notNull(),
		/** @UNIT_LOCALIZATION_EXEMPT Display copy is referenced through localized Units. */
		document: createJsonDocumentColumn().notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.hostUnitId, table.targetContract] }),
		check(
			"unit_presentation_document_target_check",
			sql`${table.targetContract} = ${UnitPresentationTargetContractV0}`,
		),
	],
);

export const unitPresentationRevision = pgTable(
	"unit_presentation_revision",
	{
		id: createUuidv7PrimaryKey(),
		hostUnitId: uuid().notNull(),
		targetContract: text().$type<typeof UnitPresentationTargetContractV0>().notNull(),
		parentRevisionId: uuid(),
		sourceRevisionId: uuid(),
		contentId: uuid()
			.notNull()
			.references(() => revisionContent.id, { onDelete: "restrict" }),
		actorProfileId: uuid().references(() => profile.id, { onDelete: "restrict" }),
		kind: text().$type<"create" | "update" | "restore">().notNull(),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		unique("unit_presentation_revision_id_host_target_key").on(
			table.id,
			table.hostUnitId,
			table.targetContract,
		),
		foreignKey({
			columns: [table.hostUnitId, table.targetContract],
			foreignColumns: [
				unitPresentationDocument.hostUnitId,
				unitPresentationDocument.targetContract,
			],
			name: "unit_presentation_revision_document_fkey",
		}).onDelete("cascade"),
		foreignKey({
			columns: [table.parentRevisionId, table.hostUnitId, table.targetContract],
			foreignColumns: [table.id, table.hostUnitId, table.targetContract],
			name: "unit_presentation_revision_parent_fkey",
		}).onDelete("restrict"),
		foreignKey({
			columns: [table.sourceRevisionId, table.hostUnitId, table.targetContract],
			foreignColumns: [table.id, table.hostUnitId, table.targetContract],
			name: "unit_presentation_revision_source_fkey",
		}).onDelete("restrict"),
		index("unit_presentation_revision_host_created_idx").on(
			table.hostUnitId,
			table.targetContract,
			table.createdAt.desc(),
			table.id.desc(),
		),
		index("unit_presentation_revision_content_idx").on(table.contentId),
		index("unit_presentation_revision_actor_idx").on(
			table.actorProfileId,
			table.createdAt.desc(),
			table.id.desc(),
		),
		check(
			"unit_presentation_revision_kind_check",
			sql`${table.kind} in ('create', 'update', 'restore')`,
		),
		check(
			"unit_presentation_revision_source_shape_check",
			sql`(${table.kind} = 'restore') = (${table.sourceRevisionId} is not null)`,
		),
	],
);

export const unitPresentationRevisionHead = pgTable(
	"unit_presentation_revision_head",
	{
		hostUnitId: uuid().notNull(),
		targetContract: text().$type<typeof UnitPresentationTargetContractV0>().notNull(),
		revisionId: uuid().notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.hostUnitId, table.targetContract] }),
		uniqueIndex("unit_presentation_revision_head_revision_key").on(table.revisionId),
		foreignKey({
			columns: [table.revisionId, table.hostUnitId, table.targetContract],
			foreignColumns: [
				unitPresentationRevision.id,
				unitPresentationRevision.hostUnitId,
				unitPresentationRevision.targetContract,
			],
			name: "unit_presentation_revision_head_revision_fkey",
		}).onDelete("restrict"),
	],
);

/** Strictly bounded singleton used for immediate platform-wide execution disable. */
export const customThemeExecutionControl = pgTable(
	"custom_theme_execution_control",
	{
		id: boolean().primaryKey().default(true),
		enabled: boolean().default(true).notNull(),
		updatedByProfileId: uuid().references(() => profile.id, { onDelete: "restrict" }),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [check("custom_theme_execution_control_singleton_check", sql`${table.id} = true`)],
);
