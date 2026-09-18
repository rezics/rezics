import { ContentLanguageValues, type ContentLanguage } from "../shared/contract-values";
import type { RequestedAuthoritySelection } from "@rezics/access";
import { inArray, sql } from "drizzle-orm";
import {
	bigint,
	check,
	foreignKey,
	index,
	jsonb,
	primaryKey,
	text,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { pgTable } from "../shared/base";
import { createCreatedAtColumn, createTimestampMsColumn } from "../shared/columns";
import { accessScope, accessSubject } from "../access/access-identity";
import { accessMembership, accessMembershipAdmission } from "../access/access-membership";
import { users } from "../identity/auth";
import { realm, realmRuleRevision } from "./realm";
import type { EnrollmentAuthorityEvidence } from "../access/organization-membership";

/** Private notice destination selected by the original enrollment consent, independent from public presentation. @internal */
export interface RealmEnrollmentNotificationBasis {
	principalId: string;
	selection: RequestedAuthoritySelection;
}

export interface RealmEnrollmentConsentEvidence extends EnrollmentAuthorityEvidence {
	ruleLanguage?: ContentLanguage | null;
}

export const RealmEnrollmentStateValues = [
	"open",
	"invited",
	"pending",
	"approved",
	"rejected",
	"left",
	"removed",
] as const;
/** Realm policy inputs; only access_membership selects an effective admission. @internal */
export const realmEnrollment = pgTable(
	"realm_enrollment",
	{
		scopeId: uuid()
			.notNull()
			.references(() => accessScope.id),
		subjectId: uuid()
			.notNull()
			.references(() => accessSubject.id),
		realmId: uuid()
			.notNull()
			.references(() => realm.id),
		membershipId: uuid().notNull(),
		policyRevision: bigint({ mode: "number" }),
		revision: bigint({ mode: "number" }).notNull().default(0),
		state: text().$type<(typeof RealmEnrollmentStateValues)[number]>().notNull().default("open"),
		consent: jsonb().$type<RealmEnrollmentConsentEvidence>(),
		notificationBasis: jsonb().$type<RealmEnrollmentNotificationBasis>(),
		invitation: jsonb().$type<EnrollmentAuthorityEvidence>(),
		invitationContactId: uuid().references(() => realmEnrollmentContact.id),
		ruleRevisionId: uuid(),
		consentExpiresAt: createTimestampMsColumn(),
		generation: bigint({ mode: "number" }),
		createdAt: createCreatedAtColumn(),
		updatedAt: createTimestampMsColumn().notNull().defaultNow(),
	},
	(t) => [
		primaryKey({ columns: [t.scopeId, t.subjectId] }),
		index("realm_enrollment_subject_idx").on(t.subjectId, t.scopeId),
		index("realm_enrollment_realm_page_idx").on(t.realmId, t.subjectId),
		index("realm_enrollment_notice_actor_idx")
			.on(sql`(${t.notificationBasis}->>'principalId')`, t.scopeId, t.subjectId)
			.where(sql`${t.notificationBasis} is not null`),
		index("realm_enrollment_consent_actor_idx")
			.on(sql`(${t.consent}->>'principalId')`, t.scopeId, t.subjectId)
			.where(sql`${t.consent} is not null`),
		index("realm_enrollment_invitation_actor_idx")
			.on(sql`(${t.invitation}->>'principalId')`, t.scopeId, t.subjectId)
			.where(sql`${t.invitation} is not null`),
		index("realm_enrollment_erasable_subject_idx")
			.on(t.subjectId, t.scopeId)
			.where(sql`${t.state} in ('approved','pending','invited')`),
		index("realm_enrollment_pending_expiry_idx")
			.on(t.consentExpiresAt, t.scopeId, t.subjectId)
			.where(sql`${t.consentExpiresAt} is not null`),
		foreignKey({
			columns: [t.membershipId, t.scopeId, t.subjectId],
			foreignColumns: [accessMembership.id, accessMembership.scopeId, accessMembership.subjectId],
		}),
		foreignKey({
			columns: [t.membershipId, t.generation],
			foreignColumns: [
				accessMembershipAdmission.membershipId,
				accessMembershipAdmission.generation,
			],
		}),
		foreignKey({
			columns: [t.realmId, t.ruleRevisionId],
			foreignColumns: [realmRuleRevision.realmId, realmRuleRevision.id],
		}),
		check("realm_enrollment_revision_check", sql`${t.revision} between 0 and 9007199254740991`),
		check(
			"realm_enrollment_state_check",
			sql`${t.state} in ('open','invited','pending','approved','rejected','left','removed')`,
		),
		check(
			"realm_enrollment_notification_budget",
			sql`octet_length(${t.notificationBasis}::text)<=8192`,
		),
		check(
			"realm_enrollment_evidence_budget",
			sql`octet_length(${t.consent}::text)<=32768 and octet_length(${t.invitation}::text)<=32768`,
		),
	],
);
/** Restrictions survive every enrollment generation and are separately revisioned. @internal */
export const realmEnforcement = pgTable(
	"realm_enforcement",
	{
		scopeId: uuid()
			.notNull()
			.references(() => accessScope.id),
		subjectId: uuid()
			.notNull()
			.references(() => accessSubject.id),
		revision: bigint({ mode: "number" }).notNull().default(0),
		state: text().$type<"clear" | "muted" | "banned">().notNull().default("clear"),
		updatedAt: createTimestampMsColumn().notNull().defaultNow(),
	},
	(t) => [
		primaryKey({ columns: [t.scopeId, t.subjectId] }),
		index("realm_enforcement_subject_idx").on(t.subjectId, t.scopeId),
		check(
			"realm_enforcement_state_check",
			sql`${t.state} in ('clear','muted','banned') and ${t.revision} between 0 and 9007199254740991`,
		),
	],
);
/** Exact immutable private operation receipts also own application and enforcement history. @internal */
export const realmEnrollmentOperation = pgTable(
	"realm_enrollment_operation",
	{
		scopeId: uuid()
			.notNull()
			.references(() => accessScope.id),
		operationId: uuid().notNull(),
		subjectId: uuid()
			.notNull()
			.references(() => accessSubject.id),
		operatorAuthUserId: uuid().references(() => users.id),
		authoritySubjectId: uuid().references(() => accessSubject.id),
		revision: bigint({ mode: "number" }).notNull(),
		requestDigest: text().notNull(),
		operation: text().notNull(),
		result: jsonb()
			.$type<{
				state: (typeof RealmEnrollmentStateValues)[number];
				revision: number;
				membershipId: string;
				version: number;
				activeGeneration: number | null;
				lastGeneration: number;
				enforcement: "clear" | "muted" | "banned";
				enforcementRevision: number;
			}>()
			.notNull(),
		createdAt: createCreatedAtColumn(),
	},
	(t) => [
		primaryKey({ columns: [t.scopeId, t.operationId] }),
		uniqueIndex("realm_enrollment_operation_history_idx").on(t.scopeId, t.subjectId, t.revision),
		index("realm_enrollment_operation_subject_idx").on(t.subjectId, t.scopeId, t.operationId),
		check(
			"realm_enrollment_operation_actor_check",
			sql`(${t.operatorAuthUserId} is not null and ${t.authoritySubjectId} is not null and ${t.operation} in ('join','leave','acknowledge','invite','approve','reject','remove','mute','ban','clear')) or (${t.operatorAuthUserId} is null and ${t.authoritySubjectId} is null and ${t.operation} in ('expired','erased'))`,
		),
		check(
			"realm_enrollment_operation_revision_check",
			sql`${t.revision}>0 and (${t.result}->>'revision')::bigint=${t.revision}`,
		),
		check("realm_enrollment_operation_digest_check", sql`${t.requestDigest} ~ '^[0-9a-f]{64}$'`),
		check("realm_enrollment_operation_budget", sql`octet_length(${t.result}::text)<=2048`),
	],
);
/** Consent names the typed subject and exact generation; previous enrollment consent cannot revive. @internal */
export const realmEnrollmentRuleAcceptance = pgTable(
	"realm_enrollment_rule_acceptance",
	{
		membershipId: uuid().notNull(),
		generation: bigint({ mode: "number" }).notNull(),
		revisionId: uuid()
			.notNull()
			.references(() => realmRuleRevision.id),
		operatorAuthUserId: uuid()
			.notNull()
			.references(() => users.id),
		authoritySubjectId: uuid()
			.notNull()
			.references(() => accessSubject.id),
		language: text().$type<ContentLanguage>(),
		acceptedAt: createCreatedAtColumn(),
	},
	(t) => [
		primaryKey({ columns: [t.membershipId, t.generation, t.revisionId] }),
		foreignKey({
			columns: [t.membershipId, t.generation],
			foreignColumns: [
				accessMembershipAdmission.membershipId,
				accessMembershipAdmission.generation,
			],
		}),
		index("realm_enrollment_rule_revision_idx").on(t.revisionId, t.membershipId),
		check(
			"realm_enrollment_rule_language_check",
			sql`${t.language} is null or ${inArray(t.language, ContentLanguageValues)}`,
		),
	],
);

/** Explicit scope-addressed disclosure consent; creation does not reveal whether a private Realm exists. @internal */
export const realmEnrollmentContact = pgTable(
	"realm_enrollment_contact",
	{
		id: uuid().primaryKey().defaultRandom(),
		requestedRealmId: uuid().notNull(),
		subjectId: uuid()
			.notNull()
			.references(() => accessSubject.id),
		secretDigest: text(),
		revision: bigint({ mode: "number" }).notNull().default(1),
		expiresAt: createTimestampMsColumn().notNull(),
		revokedAt: createTimestampMsColumn(),
		createdAt: createCreatedAtColumn(),
	},
	(t) => [
		index("realm_enrollment_contact_subject_idx")
			.on(t.subjectId, t.id)
			.where(sql`${t.revokedAt} is null`),
		index("realm_enrollment_contact_expiry_idx")
			.on(t.expiresAt, t.id)
			.where(sql`${t.revokedAt} is null`),
		uniqueIndex("realm_enrollment_contact_secret_key")
			.on(t.secretDigest)
			.where(sql`${t.secretDigest} is not null`),
		check(
			"realm_enrollment_contact_lifecycle_check",
			sql`(${t.revision}=1 and ${t.revokedAt} is null and ${t.secretDigest} is not null and ${t.secretDigest} ~ '^[0-9a-f]{64}$') or (${t.revision}=2 and ${t.revokedAt} is not null and ${t.secretDigest} is null)`,
		),
		check(
			"realm_enrollment_contact_expiry_check",
			sql`${t.expiresAt}>${t.createdAt} and ${t.expiresAt}<=${t.createdAt}+interval '30 days'`,
		),
	],
);
