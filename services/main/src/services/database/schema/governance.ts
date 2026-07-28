import { sql } from "drizzle-orm";
import { OfficialRealmUnitIds } from "@rezics/slug";
import {
	boolean,
	check,
	foreignKey,
	index,
	integer,
	pgEnum,
	text,
	unique,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import { realm, realmRule, realmRuleRevision, realmUnit, realmUnitStatus } from "./realm";
import {
	EnforcementKindValues,
	GovernanceReasonCodeValues,
	GovernanceNoteRoleValues,
	GovernanceNoteSubjectKindValues,
	ModerationActionKindValues,
	ModerationCaseStateValues,
	ModerationTargetKindValues,
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
import { moderationStatus, profile, unit } from "./core";
import { unitRevision } from "./history";
import { post } from "./post";

export const governanceReasonCode = pgEnum(
	"governance_reason_code",
	toEnumValues(GovernanceReasonCodeValues),
);
export const moderationAuthority = pgEnum("moderation_authority", ["platform", "realm"]);
export const moderationCaseState = pgEnum(
	"moderation_case_state",
	toEnumValues(ModerationCaseStateValues),
);
export const moderationTargetKind = pgEnum(
	"moderation_target_kind",
	toEnumValues(ModerationTargetKindValues),
);
export const moderationActionKind = pgEnum(
	"moderation_action_kind",
	toEnumValues(ModerationActionKindValues),
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
export const auditAuthorityKind = pgEnum("audit_authority_kind", ["platform", "realm", "unit"]);

export const moderationCase = pgTable(
	"moderation_case",
	{
		id: createUuidv7PrimaryKey(),
		state: moderationCaseState().default("new").notNull(),
		authority: moderationAuthority().default("platform").notNull(),
		realmId: uuid().references(() => realm.id, { onDelete: "restrict" }),
		targetKind: moderationTargetKind().notNull(),
		targetId: uuid().notNull(),
		targetPath: text(),
		assignedProfileId: uuid().references(() => profile.id, { onDelete: "set null" }),
		duplicateOfCaseId: uuid(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		foreignKey({
			columns: [table.duplicateOfCaseId],
			foreignColumns: [table.id],
			name: "moderation_case_duplicate_fkey",
		}).onDelete("set null"),
		index("moderation_case_authority_state_created_idx").on(
			table.authority,
			table.state,
			table.createdAt,
			table.id,
		),
		index("moderation_case_realm_state_created_idx").on(
			table.realmId,
			table.state,
			table.createdAt,
			table.id,
		),
		index("moderation_case_assignee_state_idx").on(
			table.assignedProfileId,
			table.state,
			table.createdAt,
			table.id,
		),
		index("moderation_case_target_idx").on(table.targetKind, table.targetId),
		index("moderation_case_duplicate_idx").on(table.duplicateOfCaseId),
		check(
			"moderation_case_authority_check",
			sql`(${table.authority} = 'realm'::moderation_authority) = (${table.realmId} is not null)`,
		),
		check(
			"moderation_case_path_check",
			sql`(${table.targetKind} = 'unit_field'::moderation_target_kind) = (nullif(btrim(${table.targetPath}), '') is not null)`,
		),
		check(
			"moderation_case_duplicate_state_check",
			sql`(${table.state} = 'duplicate'::moderation_case_state) = (${table.duplicateOfCaseId} is not null)`,
		),
		check(
			"moderation_case_not_self_duplicate",
			sql`${table.duplicateOfCaseId} is null or ${table.duplicateOfCaseId} <> ${table.id}`,
		),
	],
);

export const realmUnitReport = pgTable(
	"realm_unit_report",
	{
		id: createUuidv7PrimaryKey(),
		caseId: uuid()
			.notNull()
			.references(() => moderationCase.id, { onDelete: "restrict" }),
		reporterProfileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "restrict" }),
		realmId: uuid()
			.notNull()
			.references(() => realm.id, { onDelete: "restrict" }),
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "restrict" }),
		ruleRevisionId: uuid().notNull(),
		ruleId: uuid()
			.notNull()
			.references(() => realmRule.id, { onDelete: "restrict" }),
		/** Reporter-authored evidence, stored verbatim without content-language metadata. */
		details: text(),
		reportedRevisionId: uuid().notNull(),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		foreignKey({
			columns: [table.realmId, table.unitId],
			foreignColumns: [realmUnit.realmId, realmUnit.unitId],
			name: "realm_unit_report_realm_unit_fkey",
		}).onDelete("restrict"),
		foreignKey({
			columns: [table.realmId, table.ruleRevisionId],
			foreignColumns: [realmRuleRevision.realmId, realmRuleRevision.id],
			name: "realm_unit_report_rule_revision_realm_fkey",
		}).onDelete("restrict"),
		foreignKey({
			columns: [table.ruleId, table.ruleRevisionId],
			foreignColumns: [realmRule.id, realmRule.revisionId],
			name: "realm_unit_report_rule_revision_fkey",
		}).onDelete("restrict"),
		foreignKey({
			columns: [table.reportedRevisionId, table.unitId],
			foreignColumns: [unitRevision.id, unitRevision.unitId],
			name: "realm_unit_report_revision_unit_fkey",
		}).onDelete("restrict"),
		unique("realm_unit_report_case_reporter_key").on(table.caseId, table.reporterProfileId),
		index("realm_unit_report_realm_created_at_idx").on(
			table.realmId,
			table.createdAt.desc(),
			table.id.desc(),
		),
		index("realm_unit_report_realm_unit_created_at_idx").on(
			table.realmId,
			table.unitId,
			table.createdAt.desc(),
		),
		index("realm_unit_report_unit_idx").on(table.unitId),
		index("realm_unit_report_case_idx").on(table.caseId),
		index("realm_unit_report_rule_idx").on(table.ruleId),
		index("realm_unit_report_reporter_created_at_idx").on(
			table.reporterProfileId,
			table.createdAt.desc(),
			table.id.desc(),
		),
		check(
			"realm_unit_report_details_not_blank",
			sql`${table.details} is null or btrim(${table.details}) <> ''`,
		),
		check(
			"realm_unit_report_details_length",
			sql`${table.details} is null or char_length(${table.details}) <= 2000`,
		),
	],
);

export const platformUnitReport = pgTable(
	"platform_unit_report",
	{
		id: createUuidv7PrimaryKey(),
		caseId: uuid()
			.notNull()
			.references(() => moderationCase.id, { onDelete: "restrict" }),
		reporterProfileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "restrict" }),
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "restrict" }),
		ruleSourceRealmId: uuid()
			.notNull()
			.references(() => realm.id, { onDelete: "restrict" }),
		ruleRevisionId: uuid().notNull(),
		ruleId: uuid()
			.notNull()
			.references(() => realmRule.id, { onDelete: "restrict" }),
		/** Reporter-authored evidence, stored verbatim without content-language metadata. */
		details: text(),
		reportedRevisionId: uuid().notNull(),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		foreignKey({
			columns: [table.ruleSourceRealmId, table.ruleRevisionId],
			foreignColumns: [realmRuleRevision.realmId, realmRuleRevision.id],
			name: "platform_unit_report_rule_revision_realm_fkey",
		}).onDelete("restrict"),
		foreignKey({
			columns: [table.ruleId, table.ruleRevisionId],
			foreignColumns: [realmRule.id, realmRule.revisionId],
			name: "platform_unit_report_rule_revision_fkey",
		}).onDelete("restrict"),
		foreignKey({
			columns: [table.reportedRevisionId, table.unitId],
			foreignColumns: [unitRevision.id, unitRevision.unitId],
			name: "platform_unit_report_revision_unit_fkey",
		}).onDelete("restrict"),
		unique("platform_unit_report_case_reporter_key").on(table.caseId, table.reporterProfileId),
		index("platform_unit_report_created_at_idx").on(table.createdAt.desc(), table.id.desc()),
		index("platform_unit_report_unit_created_at_idx").on(table.unitId, table.createdAt.desc()),
		index("platform_unit_report_case_idx").on(table.caseId),
		index("platform_unit_report_rule_idx").on(table.ruleId),
		index("platform_unit_report_reporter_created_at_idx").on(
			table.reporterProfileId,
			table.createdAt.desc(),
			table.id.desc(),
		),
		check(
			"platform_unit_report_details_not_blank",
			sql`${table.details} is null or btrim(${table.details}) <> ''`,
		),
		check(
			"platform_unit_report_details_length",
			sql`${table.details} is null or char_length(${table.details}) <= 2000`,
		),
		check(
			"platform_unit_report_rule_source_check",
			sql`${table.ruleSourceRealmId} = ${OfficialRealmUnitIds.rule}::uuid`,
		),
	],
);

export const moderationAction = pgTable(
	"moderation_action",
	{
		id: createUuidv7PrimaryKey(),
		caseId: uuid()
			.notNull()
			.references(() => moderationCase.id, { onDelete: "restrict" }),
		actorProfileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "restrict" }),
		kind: moderationActionKind().notNull(),
		resultingStatus: moderationStatus(),
		resultingPostTargetingLocked: boolean(),
		reasonCode: governanceReasonCode().notNull(),
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
			name: "moderation_action_reverses_fkey",
		}).onDelete("restrict"),
		uniqueIndex("moderation_action_actor_case_idempotency_key")
			.on(table.actorProfileId, table.caseId, table.idempotencyKey)
			.where(sql`${table.idempotencyKey} is not null`),
		index("moderation_action_case_created_at_idx").on(table.caseId, table.createdAt, table.id),
		index("moderation_action_actor_created_at_idx").on(
			table.actorProfileId,
			table.createdAt.desc(),
			table.id.desc(),
		),
		index("moderation_action_reverses_idx").on(table.reversesActionId),
		check(
			"moderation_action_state_outcome_check",
			sql`(${table.previousState} is null) = (${table.resultingState} is null)`,
		),
		check(
			"moderation_action_post_targeting_lock_outcome_check",
			sql`(${table.previousPostTargetingLocked} is null) = (${table.resultingPostTargetingLocked} is null)`,
		),
		check(
			"moderation_action_single_outcome_check",
			sql`${table.previousState} is null or ${table.previousPostTargetingLocked} is null`,
		),
		check(
			"moderation_action_request_fingerprint_check",
			sql`${table.requestFingerprint} is null or ${table.requestFingerprint} ~ '^[0-9a-f]{64}$'`,
		),
		check(
			"moderation_action_not_self_reverse",
			sql`${table.reversesActionId} is null or ${table.reversesActionId} <> ${table.id}`,
		),
		check(
			"moderation_action_reversal_check",
			sql`(${table.kind} in ('reverse', 'revoke_enforcement')) = (${table.reversesActionId} is not null)`,
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
		moderationActionId: uuid(),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		foreignKey({
			columns: [table.moderationActionId],
			foreignColumns: [moderationAction.id],
			name: "realm_unit_status_event_moderation_action_fkey",
		}).onDelete("restrict"),
		unique("realm_unit_status_event_action_key").on(table.moderationActionId),
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
			.references(() => moderationAction.id, { onDelete: "restrict" }),
		revocationActionId: uuid().references(() => moderationAction.id, { onDelete: "restrict" }),
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
		schemaVersion: integer().default(2).notNull(),
		category: auditEventCategory().notNull(),
		outcome: auditEventOutcome().notNull(),
		actorKind: auditActorKind().notNull(),
		actorProfileId: uuid().references(() => profile.id, { onDelete: "restrict" }),
		actorCredentialKind: auditCredentialKind().notNull(),
		actorCredentialId: text(),
		authorityKind: auditAuthorityKind().notNull(),
		authorityId: uuid(),
		action: text().notNull(),
		reasonCode: text(),
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
		index("audit_event_request_idx").on(table.requestId),
		index("audit_event_trace_idx").on(table.traceId),
		check("audit_event_schema_version_check", sql`${table.schemaVersion} > 0`),
		check("audit_event_action_check", sql`btrim(${table.action}) <> ''`),
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
