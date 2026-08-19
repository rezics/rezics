import { sql } from "drizzle-orm";
import {
	boolean,
	check,
	foreignKey,
	index,
	integer,
	pgEnum,
	primaryKey,
	smallint,
	text,
	unique,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import {
	realm,
	realmRule,
	realmRuleRevision,
	realmUnit,
	realmUnitPublicationState,
	realmUnitStatus,
} from "./realm";
import {
	AccountEnforcementActionKindValues,
	ActiveContentReviewCaseStateValues,
	ContentGovernanceActionKindValues,
	ContentReviewAuthorityValues,
	ContentReviewCaseStateValues,
	EnforcementKindValues,
	GovernanceAuthorityKindValues,
	GovernanceDecisionBasisKindValues,
	GovernanceNoteRoleValues,
	GovernanceNoteSubjectKindValues,
	toEnumValues,
} from "./contract-values";
import {
	createCreatedAtColumn,
	createJsonObjectColumn,
	createJsonObjectConstraint,
	createTimestampMsColumn,
	createUpdatedAtColumn,
	createUuidv7PrimaryKey,
} from "./columns";
import { profile } from "./profile";
import { unit } from "./unit";
import { unitLicenseGrant, unitLicenseRecognitionStatus } from "./unit";
import { unitRevision } from "./history";
import { post } from "./post";
import { zone } from "./zone";
import { users } from "./auth";

export const governanceAuthorityKind = pgEnum(
	"governance_authority_kind",
	toEnumValues(GovernanceAuthorityKindValues),
);
export const governanceDecisionBasisKind = pgEnum(
	"governance_decision_basis_kind",
	toEnumValues(GovernanceDecisionBasisKindValues),
);
export const contentReviewAuthority = pgEnum(
	"content_review_authority",
	toEnumValues(ContentReviewAuthorityValues),
);
export const contentReviewCaseState = pgEnum(
	"content_review_case_state",
	toEnumValues(ContentReviewCaseStateValues),
);
export const contentGovernanceActionKind = pgEnum(
	"content_governance_action_kind",
	toEnumValues(ContentGovernanceActionKindValues),
);
export const accountEnforcementActionKind = pgEnum(
	"account_enforcement_action_kind",
	toEnumValues(AccountEnforcementActionKindValues),
);
export const enforcementKind = pgEnum("enforcement_kind", toEnumValues(EnforcementKindValues));
export const governanceNoteRole = pgEnum(
	"governance_note_role",
	toEnumValues(GovernanceNoteRoleValues),
);
export const governanceNoteSubjectKind = pgEnum(
	"governance_note_subject_kind",
	toEnumValues(GovernanceNoteSubjectKindValues),
);
export const auditEventCategory = pgEnum("audit_event_category", [
	"admin_activity",
	"policy_denied",
	"system_event",
]);
export const auditEventOutcome = pgEnum("audit_event_outcome", ["succeeded", "denied", "failed"]);
export const auditActorKind = pgEnum("audit_actor_kind", ["profile", "system"]);
export const auditCredentialKind = pgEnum("audit_credential_kind", [
	"session",
	"api_token",
	"bootstrap",
	"system",
]);
export const auditAuthorityKind = pgEnum("audit_authority_kind", [
	"platform",
	"realm",
	"zone",
	"unit",
]);
export const AuditEventSchemaVersion = 2 as const;

/**
 * Immutable, cross-domain governance decision ledger.
 *
 * Domain action tables retain their operational state, while this relation is
 * the single source of truth for authority, policy basis, and reversals.
 */
export const governanceDecision = pgTable(
	"governance_decision",
	{
		id: createUuidv7PrimaryKey(),
		action: text().notNull(),
		basisKind: governanceDecisionBasisKind().notNull(),
		actorProfileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "restrict" }),
		authorityKind: governanceAuthorityKind().notNull(),
		authorityRealmId: uuid().references(() => realm.id, { onDelete: "restrict" }),
		authorityZoneId: uuid().references(() => zone.id, { onDelete: "restrict" }),
		authorityUnitId: uuid().references(() => unit.id, { onDelete: "restrict" }),
		targetUnitId: uuid().references(() => unit.id, { onDelete: "restrict" }),
		targetUserId: uuid().references(() => users.id, { onDelete: "restrict" }),
		subjectKind: text().notNull(),
		subjectId: uuid().notNull(),
		reversesDecisionId: uuid(),
		requestId: text(),
		finalized: boolean().notNull().default(false),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		foreignKey({
			columns: [table.reversesDecisionId],
			foreignColumns: [table.id],
			name: "governance_decision_reverses_fkey",
		}).onDelete("restrict"),
		uniqueIndex("governance_decision_reverses_key")
			.on(table.reversesDecisionId)
			.where(sql`${table.reversesDecisionId} is not null`),
		index("governance_decision_target_created_idx")
			.on(table.targetUnitId, table.createdAt.desc(), table.id.desc())
			.where(sql`${table.targetUnitId} is not null`),
		index("governance_decision_target_user_created_idx")
			.on(table.targetUserId, table.createdAt.desc(), table.id.desc())
			.where(sql`${table.targetUserId} is not null`),
		index("governance_decision_subject_created_idx").on(
			table.subjectKind,
			table.subjectId,
			table.createdAt.desc(),
			table.id.desc(),
		),
		index("governance_decision_actor_created_idx").on(
			table.actorProfileId,
			table.createdAt.desc(),
			table.id.desc(),
		),
		index("governance_decision_realm_created_idx")
			.on(table.authorityRealmId, table.createdAt.desc(), table.id.desc())
			.where(sql`${table.authorityRealmId} is not null`),
		index("governance_decision_zone_created_idx")
			.on(table.authorityZoneId, table.createdAt.desc(), table.id.desc())
			.where(sql`${table.authorityZoneId} is not null`),
		check(
			"governance_decision_target_check",
			sql`num_nonnulls(${table.targetUnitId}, ${table.targetUserId}) = 1`,
		),
		check(
			"governance_decision_action_check",
			sql`btrim(${table.action}) <> '' and octet_length(${table.action}) <= 128`,
		),
		check(
			"governance_decision_subject_kind_check",
			sql`btrim(${table.subjectKind}) <> '' and octet_length(${table.subjectKind}) <= 64`,
		),
		check(
			"governance_decision_request_id_check",
			sql`${table.requestId} is null or (btrim(${table.requestId}) <> '' and octet_length(${table.requestId}) <= 200)`,
		),
		check(
			"governance_decision_authority_check",
			sql`(
				${table.authorityKind} = 'platform'::governance_authority_kind
				and num_nonnulls(${table.authorityRealmId}, ${table.authorityZoneId}, ${table.authorityUnitId}) = 0
			) or (
				${table.authorityKind} = 'realm'::governance_authority_kind
				and ${table.authorityRealmId} is not null
				and num_nonnulls(${table.authorityZoneId}, ${table.authorityUnitId}) = 0
			) or (
				${table.authorityKind} = 'zone'::governance_authority_kind
				and ${table.authorityZoneId} is not null
				and num_nonnulls(${table.authorityRealmId}, ${table.authorityUnitId}) = 0
			) or (
				${table.authorityKind} = 'unit'::governance_authority_kind
				and ${table.authorityUnitId} is not null
				and num_nonnulls(${table.authorityRealmId}, ${table.authorityZoneId}) = 0
			)`,
		),
		check(
			"governance_decision_basis_check",
			sql`(${table.basisKind} = 'reversal'::governance_decision_basis_kind) = (${table.reversesDecisionId} is not null)`,
		),
		check(
			"governance_decision_not_self_reverse",
			sql`${table.reversesDecisionId} is null or ${table.reversesDecisionId} <> ${table.id}`,
		),
	],
);

export const governanceDecisionRule = pgTable(
	"governance_decision_rule",
	{
		decisionId: uuid()
			.notNull()
			.references(() => governanceDecision.id, { onDelete: "cascade" }),
		ruleSourceRealmId: uuid()
			.notNull()
			.references(() => realm.id, { onDelete: "restrict" }),
		ruleRevisionId: uuid().notNull(),
		ruleId: uuid()
			.notNull()
			.references(() => realmRule.id, { onDelete: "restrict" }),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		foreignKey({
			columns: [table.ruleSourceRealmId, table.ruleRevisionId],
			foreignColumns: [realmRuleRevision.realmId, realmRuleRevision.id],
			name: "governance_decision_rule_revision_realm_fkey",
		}).onDelete("restrict"),
		foreignKey({
			columns: [table.ruleId, table.ruleRevisionId],
			foreignColumns: [realmRule.id, realmRule.revisionId],
			name: "governance_decision_rule_revision_fkey",
		}).onDelete("restrict"),
		primaryKey({
			columns: [table.decisionId, table.ruleId],
			name: "governance_decision_rule_pkey",
		}),
		index("governance_decision_rule_source_decision_idx").on(
			table.ruleSourceRealmId,
			table.decisionId,
		),
		index("governance_decision_rule_rule_decision_idx").on(table.ruleId, table.decisionId),
	],
);

export const contentReviewCase = pgTable(
	"content_review_case",
	{
		id: createUuidv7PrimaryKey(),
		state: contentReviewCaseState().default("new").notNull(),
		authority: contentReviewAuthority().default("platform").notNull(),
		realmId: uuid().references(() => realm.id, { onDelete: "restrict" }),
		targetUnitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "restrict" }),
		assignedProfileId: uuid().references(() => profile.id, { onDelete: "set null" }),
		duplicateOfCaseId: uuid(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		foreignKey({
			columns: [table.duplicateOfCaseId],
			foreignColumns: [table.id],
			name: "content_review_case_duplicate_fkey",
		}).onDelete("set null"),
		index("content_review_case_authority_state_created_idx").on(
			table.authority,
			table.state,
			table.createdAt,
			table.id,
		),
		index("content_review_case_authority_created_idx").on(
			table.authority,
			table.createdAt.desc(),
			table.id.desc(),
		),
		index("content_review_case_realm_state_created_idx").on(
			table.realmId,
			table.state,
			table.createdAt,
			table.id,
		),
		index("content_review_case_realm_created_idx").on(
			table.realmId,
			table.createdAt.desc(),
			table.id.desc(),
		),
		index("content_review_case_platform_updated_idx")
			.on(table.updatedAt.desc(), table.id.desc())
			.where(sql`${table.authority} = 'platform'::content_review_authority`),
		index("content_review_case_platform_state_updated_idx")
			.on(table.state, table.updatedAt.desc(), table.id.desc())
			.where(sql`${table.authority} = 'platform'::content_review_authority`),
		index("content_review_case_assignee_state_idx").on(
			table.assignedProfileId,
			table.state,
			table.createdAt,
			table.id,
		),
		index("content_review_case_target_idx").on(table.targetUnitId, table.createdAt, table.id),
		index("content_review_case_duplicate_idx").on(table.duplicateOfCaseId),
		uniqueIndex("content_review_case_platform_active_target_key")
			.on(table.targetUnitId)
			.where(
				sql`${table.authority} = 'platform'::content_review_authority and ${table.state} in (${sql.join(
					ActiveContentReviewCaseStateValues.map(
						(state) => sql`${state}::content_review_case_state`,
					),
					sql`, `,
				)})`,
			),
		uniqueIndex("content_review_case_realm_active_target_key")
			.on(table.realmId, table.targetUnitId)
			.where(
				sql`${table.authority} = 'realm'::content_review_authority and ${table.state} in (${sql.join(
					ActiveContentReviewCaseStateValues.map(
						(state) => sql`${state}::content_review_case_state`,
					),
					sql`, `,
				)})`,
			),
		check(
			"content_review_case_authority_check",
			sql`(${table.authority} = 'realm'::content_review_authority) = (${table.realmId} is not null)`,
		),
		check(
			"content_review_case_duplicate_state_check",
			sql`(${table.state} = 'duplicate'::content_review_case_state) = (${table.duplicateOfCaseId} is not null)`,
		),
		check(
			"content_review_case_not_self_duplicate",
			sql`${table.duplicateOfCaseId} is null or ${table.duplicateOfCaseId} <> ${table.id}`,
		),
	],
);

export const contentReport = pgTable(
	"content_report",
	{
		id: createUuidv7PrimaryKey(),
		reporterProfileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "restrict" }),
		contextRealmId: uuid().references(() => realm.id, { onDelete: "restrict" }),
		targetUnitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "restrict" }),
		/** Reporter-authored evidence, stored verbatim without content-language metadata. */
		details: text(),
		reportedRevisionId: uuid().notNull(),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		foreignKey({
			columns: [table.reportedRevisionId, table.targetUnitId],
			foreignColumns: [unitRevision.id, unitRevision.unitId],
			name: "content_report_revision_unit_fkey",
		}).onDelete("restrict"),
		index("content_report_reporter_created_idx").on(
			table.reporterProfileId,
			table.createdAt.desc(),
			table.id.desc(),
		),
		index("content_report_context_target_created_idx").on(
			table.contextRealmId,
			table.targetUnitId,
			table.createdAt.desc(),
			table.id.desc(),
		),
		index("content_report_target_created_idx").on(
			table.targetUnitId,
			table.createdAt.desc(),
			table.id.desc(),
		),
		check(
			"content_report_details_not_blank",
			sql`${table.details} is null or btrim(${table.details}) <> ''`,
		),
		check(
			"content_report_details_length",
			sql`${table.details} is null or char_length(${table.details}) <= 2000`,
		),
	],
);

export const contentReportRule = pgTable(
	"content_report_rule",
	{
		reportId: uuid()
			.notNull()
			.references(() => contentReport.id, { onDelete: "cascade" }),
		ruleSourceRealmId: uuid()
			.notNull()
			.references(() => realm.id, { onDelete: "restrict" }),
		ruleRevisionId: uuid().notNull(),
		ruleId: uuid()
			.notNull()
			.references(() => realmRule.id, { onDelete: "restrict" }),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		foreignKey({
			columns: [table.ruleSourceRealmId, table.ruleRevisionId],
			foreignColumns: [realmRuleRevision.realmId, realmRuleRevision.id],
			name: "content_report_rule_revision_realm_fkey",
		}).onDelete("restrict"),
		foreignKey({
			columns: [table.ruleId, table.ruleRevisionId],
			foreignColumns: [realmRule.id, realmRule.revisionId],
			name: "content_report_rule_revision_fkey",
		}).onDelete("restrict"),
		primaryKey({
			columns: [table.reportId, table.ruleId],
			name: "content_report_rule_pkey",
		}),
		index("content_report_rule_source_report_idx").on(table.ruleSourceRealmId, table.reportId),
		index("content_report_rule_rule_report_idx").on(table.ruleId, table.reportId),
	],
);

export const contentReportReferral = pgTable(
	"content_report_referral",
	{
		id: createUuidv7PrimaryKey(),
		reportId: uuid()
			.notNull()
			.references(() => contentReport.id, { onDelete: "cascade" }),
		caseId: uuid()
			.notNull()
			.references(() => contentReviewCase.id, { onDelete: "restrict" }),
		ruleSourceRealmId: uuid()
			.notNull()
			.references(() => realm.id, { onDelete: "restrict" }),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		unique("content_report_referral_report_source_key").on(table.reportId, table.ruleSourceRealmId),
		unique("content_report_referral_case_report_key").on(table.caseId, table.reportId),
		index("content_report_referral_case_created_idx").on(
			table.caseId,
			table.createdAt.desc(),
			table.id.desc(),
		),
		index("content_report_referral_source_created_idx").on(
			table.ruleSourceRealmId,
			table.createdAt.desc(),
			table.id.desc(),
		),
		index("content_report_referral_report_idx").on(table.reportId, table.caseId),
	],
);

/** A fixed 256-way counter fan-out bounds contention on viral review cases. */
export const contentReviewCaseReportCounter = pgTable(
	"content_review_case_report_counter",
	{
		caseId: uuid()
			.notNull()
			.references(() => contentReviewCase.id, { onDelete: "cascade" }),
		bucket: smallint().notNull(),
		count: integer().default(0).notNull(),
	},
	(table) => [
		primaryKey({
			columns: [table.caseId, table.bucket],
			name: "content_review_case_report_counter_pkey",
		}),
		check(
			"content_review_case_report_counter_bucket_check",
			sql`${table.bucket} between 0 and 255`,
		),
		check("content_review_case_report_counter_count_check", sql`${table.count} >= 0`),
	],
);

export const contentGovernanceAction = pgTable(
	"content_governance_action",
	{
		id: createUuidv7PrimaryKey(),
		decisionId: uuid().references(() => governanceDecision.id, { onDelete: "restrict" }),
		caseId: uuid()
			.notNull()
			.references(() => contentReviewCase.id, { onDelete: "restrict" }),
		actorProfileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "restrict" }),
		kind: contentGovernanceActionKind().notNull(),
		resultingPostTargetingLocked: boolean(),
		licenseGrantId: uuid(),
		previousRecognitionStatus: unitLicenseRecognitionStatus(),
		resultingRecognitionStatus: unitLicenseRecognitionStatus(),
		reversesActionId: uuid(),
		previousState: text(),
		resultingState: text(),
		previousPostTargetingLocked: boolean(),
		requestId: text(),
		idempotencyKey: text(),
		requestFingerprint: text(),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		foreignKey({
			columns: [table.reversesActionId],
			foreignColumns: [table.id],
			name: "content_governance_action_reverses_fkey",
		}).onDelete("restrict"),
		foreignKey({
			columns: [table.licenseGrantId],
			foreignColumns: [unitLicenseGrant.id],
			name: "content_governance_action_license_grant_fkey",
		}).onDelete("restrict"),
		uniqueIndex("content_governance_action_actor_case_idempotency_key")
			.on(table.actorProfileId, table.caseId, table.idempotencyKey)
			.where(sql`${table.idempotencyKey} is not null`),
		uniqueIndex("content_governance_action_decision_key")
			.on(table.decisionId)
			.where(sql`${table.decisionId} is not null`),
		index("content_governance_action_case_created_idx").on(
			table.caseId,
			table.createdAt.desc(),
			table.id.desc(),
		),
		index("content_governance_action_actor_created_idx").on(
			table.actorProfileId,
			table.createdAt.desc(),
			table.id.desc(),
		),
		uniqueIndex("content_governance_action_reverses_key")
			.on(table.reversesActionId)
			.where(sql`${table.reversesActionId} is not null`),
		index("content_governance_action_license_grant_created_idx").on(
			table.licenseGrantId,
			table.createdAt.desc(),
			table.id.desc(),
		),
		check(
			"content_governance_action_state_outcome_check",
			sql`(${table.previousState} is null) = (${table.resultingState} is null)`,
		),
		check(
			"content_governance_action_post_targeting_lock_outcome_check",
			sql`(${table.previousPostTargetingLocked} is null) = (${table.resultingPostTargetingLocked} is null)`,
		),
		check(
			"content_governance_action_single_outcome_check",
			sql`num_nonnulls(
				${table.previousState},
				${table.previousPostTargetingLocked},
				${table.previousRecognitionStatus}
			) <= 1`,
		),
		check(
			"content_governance_action_kind_outcome_check",
			sql`(
				${table.kind} in ('approve', 'hide', 'remove', 'restore')
				and ${table.previousState} is not null
			) or (
				${table.kind} in ('lock_post_targeting', 'unlock_post_targeting')
				and ${table.previousPostTargetingLocked} is not null
			) or (
				${table.kind} in ('invalidate_license', 'restore_license')
				and ${table.previousRecognitionStatus} is not null
			) or (
				${table.kind} = 'reverse'
				and num_nonnulls(
					${table.previousState},
					${table.previousPostTargetingLocked}
				) = 1
			)`,
		),
		check(
			"content_governance_action_license_grant_transition_check",
			sql`(
				${table.kind} = 'invalidate_license'
				and ${table.licenseGrantId} is not null
				and ${table.previousRecognitionStatus} is not null
				and ${table.previousRecognitionStatus} = 'recognized'
				and ${table.resultingRecognitionStatus} is not null
				and ${table.resultingRecognitionStatus} = 'invalidated'
			) or (
				${table.kind} = 'restore_license'
				and ${table.licenseGrantId} is not null
				and ${table.previousRecognitionStatus} is not null
				and ${table.previousRecognitionStatus} = 'invalidated'
				and ${table.resultingRecognitionStatus} is not null
				and ${table.resultingRecognitionStatus} = 'recognized'
			) or (
				${table.kind} not in (
					'invalidate_license',
					'restore_license'
				)
				and ${table.licenseGrantId} is null
				and ${table.previousRecognitionStatus} is null
				and ${table.resultingRecognitionStatus} is null
			)`,
		),
		check(
			"content_governance_action_request_fingerprint_check",
			sql`${table.requestFingerprint} is null or ${table.requestFingerprint} ~ '^[0-9a-f]{64}$'`,
		),
		check(
			"content_governance_action_not_self_reverse",
			sql`${table.reversesActionId} is null or ${table.reversesActionId} <> ${table.id}`,
		),
		check(
			"content_governance_action_reversal_check",
			sql`(${table.kind} in ('reverse', 'restore_license')) = (${table.reversesActionId} is not null)`,
		),
	],
);

export const realmUnitStatusEvent = pgTable(
	"realm_unit_status_event",
	{
		id: createUuidv7PrimaryKey(),
		realmId: uuid()
			.notNull()
			.references(() => realm.id, { onDelete: "restrict" }),
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "restrict" }),
		fromStatus: realmUnitStatus(),
		toStatus: realmUnitStatus().notNull(),
		changedByProfileId: uuid().references(() => profile.id, {
			onDelete: "set null",
		}),
		contentGovernanceActionId: uuid(),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		foreignKey({
			columns: [table.contentGovernanceActionId],
			foreignColumns: [contentGovernanceAction.id],
			name: "realm_unit_status_event_content_governance_action_fkey",
		}).onDelete("restrict"),
		unique("realm_unit_status_event_content_governance_action_key").on(
			table.contentGovernanceActionId,
		),
		index("realm_unit_status_event_history_idx").on(
			table.realmId,
			table.unitId,
			table.createdAt.desc(),
			table.id.desc(),
		),
		index("realm_unit_status_event_actor_idx").on(table.changedByProfileId),
		check(
			"realm_unit_status_event_transition_check",
			sql`${table.fromStatus} is null or ${table.fromStatus} <> ${table.toStatus}`,
		),
	],
);

/**
 * Append-only Unit-side publication intent history.
 *
 * Realm governance transitions are recorded independently in
 * `realm_unit_status_event`; neither axis is allowed to overwrite the other.
 */
export const realmUnitPublicationEvent = pgTable(
	"realm_unit_publication_event",
	{
		id: createUuidv7PrimaryKey(),
		realmId: uuid().notNull(),
		unitId: uuid().notNull(),
		fromState: realmUnitPublicationState("from_state"),
		toState: realmUnitPublicationState("to_state").notNull(),
		changedByProfileId: uuid().references(() => profile.id, {
			onDelete: "set null",
		}),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		foreignKey({
			columns: [table.realmId, table.unitId],
			foreignColumns: [realmUnit.realmId, realmUnit.unitId],
			name: "realm_unit_publication_event_relation_fkey",
		}).onDelete("restrict"),
		index("realm_unit_publication_event_history_idx").on(
			table.unitId,
			table.realmId,
			table.createdAt.desc(),
			table.id.desc(),
		),
		index("realm_unit_publication_event_actor_idx").on(table.changedByProfileId),
		check(
			"realm_unit_publication_event_transition_check",
			sql`${table.fromState} is null or ${table.fromState} <> ${table.toState}`,
		),
	],
);

export const governancePostBinding = pgTable(
	"governance_post_binding",
	{
		postId: uuid()
			.primaryKey()
			.references(() => post.id, { onDelete: "restrict" }),
		subjectKind: governanceNoteSubjectKind().notNull(),
		subjectId: uuid().notNull(),
		role: governanceNoteRole().notNull(),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		index("governance_post_binding_subject_idx").on(table.subjectKind, table.subjectId),
		index("governance_post_binding_subject_role_idx").on(
			table.subjectKind,
			table.subjectId,
			table.role,
		),
	],
);

export const accountEnforcementAction = pgTable(
	"account_enforcement_action",
	{
		id: createUuidv7PrimaryKey(),
		decisionId: uuid().references(() => governanceDecision.id, { onDelete: "restrict" }),
		actorProfileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "restrict" }),
		targetProfileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "restrict" }),
		kind: accountEnforcementActionKind().notNull(),
		enforcementKind: enforcementKind().notNull(),
		reversesActionId: uuid(),
		requestId: text(),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		foreignKey({
			columns: [table.reversesActionId],
			foreignColumns: [table.id],
			name: "account_enforcement_action_reverses_fkey",
		}).onDelete("restrict"),
		uniqueIndex("account_enforcement_action_reverses_key")
			.on(table.reversesActionId)
			.where(sql`${table.reversesActionId} is not null`),
		uniqueIndex("account_enforcement_action_decision_key")
			.on(table.decisionId)
			.where(sql`${table.decisionId} is not null`),
		index("account_enforcement_action_target_created_idx").on(
			table.targetProfileId,
			table.createdAt.desc(),
			table.id.desc(),
		),
		index("account_enforcement_action_actor_created_idx").on(
			table.actorProfileId,
			table.createdAt.desc(),
			table.id.desc(),
		),
		check(
			"account_enforcement_action_reversal_check",
			sql`(${table.kind} = 'revoke'::account_enforcement_action_kind) = (${table.reversesActionId} is not null)`,
		),
		check(
			"account_enforcement_action_not_self_reverse",
			sql`${table.reversesActionId} is null or ${table.reversesActionId} <> ${table.id}`,
		),
	],
);

export const accountEnforcement = pgTable(
	"account_enforcement",
	{
		id: createUuidv7PrimaryKey(),
		profileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "cascade" }),
		kind: enforcementKind().notNull(),
		startsAt: createTimestampMsColumn().defaultNow().notNull(),
		expiresAt: createTimestampMsColumn(),
		decisionActionId: uuid()
			.notNull()
			.references(() => accountEnforcementAction.id, { onDelete: "restrict" }),
		revocationActionId: uuid().references(() => accountEnforcementAction.id, {
			onDelete: "restrict",
		}),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		unique("account_enforcement_decision_action_key").on(table.decisionActionId),
		uniqueIndex("account_enforcement_revocation_action_key")
			.on(table.revocationActionId)
			.where(sql`${table.revocationActionId} is not null`),
		index("account_enforcement_profile_kind_expiry_idx").on(
			table.profileId,
			table.kind,
			table.expiresAt,
		),
		check(
			"account_enforcement_time_check",
			sql`${table.expiresAt} is null or ${table.expiresAt} > ${table.startsAt}`,
		),
		check(
			"account_enforcement_action_check",
			sql`${table.revocationActionId} is null or ${table.revocationActionId} <> ${table.decisionActionId}`,
		),
	],
);

export const auditEvent = pgTable(
	"audit_event",
	{
		id: createUuidv7PrimaryKey(),
		schemaVersion: integer().default(AuditEventSchemaVersion).notNull(),
		category: auditEventCategory().notNull(),
		outcome: auditEventOutcome().notNull(),
		actorKind: auditActorKind().notNull(),
		actorProfileId: uuid().references(() => profile.id, { onDelete: "restrict" }),
		actorCredentialKind: auditCredentialKind().notNull(),
		actorCredentialId: text(),
		authorityKind: auditAuthorityKind().notNull(),
		authorityId: uuid(),
		action: text().notNull(),
		outcomeCode: text(),
		governanceDecisionId: uuid().references(() => governanceDecision.id, {
			onDelete: "restrict",
		}),
		requestId: text(),
		traceId: text(),
		targetKind: text(),
		targetId: uuid(),
		targetPath: text(),
		details: createJsonObjectColumn(),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		index("audit_event_actor_created_at_idx").on(
			table.actorProfileId,
			table.createdAt.desc(),
			table.id.desc(),
		),
		index("audit_event_action_created_at_idx").on(
			table.action,
			table.createdAt.desc(),
			table.id.desc(),
		),
		index("audit_event_category_created_at_idx").on(
			table.category,
			table.createdAt.desc(),
			table.id.desc(),
		),
		index("audit_event_authority_created_at_idx").on(
			table.authorityKind,
			table.authorityId,
			table.createdAt.desc(),
		),
		index("audit_event_target_idx").on(table.targetKind, table.targetId),
		index("audit_event_governance_decision_idx")
			.on(table.governanceDecisionId)
			.where(sql`${table.governanceDecisionId} is not null`),
		index("audit_event_request_idx").on(table.requestId),
		index("audit_event_trace_idx").on(table.traceId),
		check("audit_event_schema_version_check", sql`${table.schemaVersion} in (1, 2)`),
		check("audit_event_action_check", sql`btrim(${table.action}) <> ''`),
		check(
			"audit_event_outcome_code_check",
			sql`${table.outcomeCode} is null or (btrim(${table.outcomeCode}) <> '' and octet_length(${table.outcomeCode}) <= 128)`,
		),
		check(
			"audit_event_actor_check",
			sql`(${table.actorKind} = 'profile'::audit_actor_kind) = (${table.actorProfileId} is not null)`,
		),
		check(
			"audit_event_authority_check",
			sql`(${table.authorityKind} = 'platform'::audit_authority_kind) = (${table.authorityId} is null)`,
		),
		check(
			"audit_event_target_check",
			sql`${table.targetKind} is not null or (${table.targetId} is null and ${table.targetPath} is null)`,
		),
		createJsonObjectConstraint("audit_event_details_json_object_check", table.details),
	],
);
