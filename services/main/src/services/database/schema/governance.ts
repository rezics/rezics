import { sql } from "drizzle-orm";
import {
	boolean,
	check,
	foreignKey,
	index,
	pgEnum,
	text,
	unique,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import { realm, realmUnitStatus } from "./realm";
import {
	EnforcementKindValues,
	FeedbackKindValues,
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
import { post } from "./post";

export const feedbackKind = pgEnum("feedback_kind", toEnumValues(FeedbackKindValues));
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

export const feedback = pgTable(
	"feedback",
	{
		id: createUuidv7PrimaryKey(),
		profileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "restrict" }),
		kind: feedbackKind().default("report").notNull(),
		url: text(),
		subjectUnitId: uuid().references(() => unit.id, { onDelete: "set null" }),
		resolutionCode: governanceReasonCode(),
		resolvedByProfileId: uuid().references(() => profile.id, { onDelete: "set null" }),
		resolvedAt: createTimestampMsColumn(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		index("feedback_profile_created_at_idx").on(
			table.profileId,
			table.createdAt.desc(),
			table.id.desc(),
		),
		index("feedback_open_created_at_idx")
			.on(table.createdAt, table.id)
			.where(sql`${table.resolvedAt} is null`),
		index("feedback_subject_unit_idx").on(table.subjectUnitId),
		index("feedback_resolved_by_idx").on(table.resolvedByProfileId),
		check(
			"feedback_resolution_check",
			sql`(${table.resolvedAt} is null and ${table.resolvedByProfileId} is null and ${table.resolutionCode} is null) or (${table.resolvedAt} is not null and ${table.resolvedByProfileId} is not null and ${table.resolutionCode} is not null)`,
		),
	],
);

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
		reporterProfileId: uuid().references(() => profile.id, { onDelete: "set null" }),
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
		index("moderation_case_reporter_idx").on(table.reporterProfileId),
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
		actorProfileId: uuid().references(() => profile.id, { onDelete: "restrict" }),
		action: text().notNull(),
		decisionCode: text().notNull(),
		requestId: text(),
		subjectKind: text(),
		subjectId: uuid(),
		subjectPath: text(),
		metadata: createJsonObjectColumn(),
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
		index("audit_event_subject_idx").on(table.subjectKind, table.subjectId),
		index("audit_event_request_idx").on(table.requestId),
		check(
			"audit_event_action_check",
			sql`btrim(${table.action}) <> '' and btrim(${table.decisionCode}) <> ''`,
		),
		check(
			"audit_event_subject_check",
			sql`(${table.subjectKind} is null) = (${table.subjectId} is null)`,
		),
		createJsonObjectConstraint("audit_event_metadata_json_object_check", table.metadata),
	],
);
