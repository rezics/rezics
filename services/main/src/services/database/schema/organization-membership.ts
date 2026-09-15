import { sql } from "drizzle-orm";
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
import { pgTable } from "./base";
import { users } from "./auth";
import { entityParticipation } from "./participation";
import { accessSubject, accessScope } from "./access-identity";
import { accessMembership, accessMembershipAdmission } from "./access-membership";
import { createCreatedAtColumn, createTimestampMsColumn, createUuidv7PrimaryKey } from "./columns";
import type { RequestedAuthoritySelection } from "@rezics/access";
import type { FirstPartyCredentialProof } from "../../auth/credential-authority";

export const OrganizationMembershipInvitationStateValues = [
	"pending",
	"accepted",
	"declined",
	"revoked",
	"expired",
	"invalidated",
] as const;
/** Private original authority, revalidated at acceptance; never a transport value. @internal */
export interface EnrollmentAuthorityEvidence {
	principalId: string;
	selection: RequestedAuthoritySelection;
	proof: FirstPartyCredentialProof;
	sourceDigest: string;
}
/** Scope-specific recipient consent to disclosure; a contact secret only locates this revocable row. @internal */
export const organizationEnrollmentContact = pgTable(
	"organization_enrollment_contact",
	{
		id: createUuidv7PrimaryKey(),
		scopeId: uuid()
			.notNull()
			.references(() => accessScope.id),
		subjectId: uuid()
			.notNull()
			.references(() => accessSubject.id),
		secretDigest: text().notNull(),
		version: bigint({ mode: "number" }).notNull().default(1),
		expiresAt: createTimestampMsColumn().notNull(),
		revokedAt: createTimestampMsColumn(),
		createdAt: createCreatedAtColumn(),
	},
	(t) => [
		uniqueIndex("org_enrollment_contact_secret_key").on(t.secretDigest),
		index("org_enrollment_contact_subject_idx").on(t.subjectId, t.id),
		index("org_enrollment_contact_active_subject_idx")
			.on(t.subjectId, t.id)
			.where(sql`${t.revokedAt} is null`),
		index("org_enrollment_contact_expiry_idx")
			.on(t.expiresAt, t.id)
			.where(sql`${t.revokedAt} is null`),
		check("org_enrollment_contact_digest_check", sql`${t.secretDigest} ~ '^[0-9a-f]{64}$'`),
		check(
			"org_enrollment_contact_time_check",
			sql`${t.expiresAt}>${t.createdAt} and ${t.expiresAt}<=${t.createdAt}+interval '30 days'`,
		),
		check(
			"org_enrollment_contact_version_check",
			sql`${t.version} in (1,2) and ((${t.version}=1 and ${t.revokedAt} is null) or (${t.version}=2 and ${t.revokedAt} is not null))`,
		),
	],
);
/** Org policy inputs; the accepted generation lives exclusively in access_membership. @internal */
export const organizationEnrollmentInvitation = pgTable(
	"organization_enrollment_invitation",
	{
		id: createUuidv7PrimaryKey(),
		organizationEntityId: uuid()
			.notNull()
			.references(() => entityParticipation.entityId),
		scopeId: uuid()
			.notNull()
			.references(() => accessScope.id),
		organizationRevision: bigint({ mode: "number" }).notNull(),
		recipientSubjectId: uuid()
			.notNull()
			.references(() => accessSubject.id),
		contactId: uuid().references(() => organizationEnrollmentContact.id),
		invitedByAuthUserId: uuid()
			.notNull()
			.references(() => users.id),
		authoritySubjectId: uuid()
			.notNull()
			.references(() => accessSubject.id),
		authority: jsonb().$type<EnrollmentAuthorityEvidence>(),
		state: text()
			.$type<(typeof OrganizationMembershipInvitationStateValues)[number]>()
			.notNull()
			.default("pending"),
		revision: bigint({ mode: "number" }).notNull().default(1),
		membershipId: uuid(),
		generation: bigint({ mode: "number" }),
		expiresAt: createTimestampMsColumn().notNull(),
		resolvedAt: createTimestampMsColumn(),
		createdAt: createCreatedAtColumn(),
	},
	(t) => [
		uniqueIndex("org_enrollment_pending_pair_key")
			.on(t.scopeId, t.recipientSubjectId)
			.where(sql`${t.state}='pending'`),
		index("org_enrollment_scope_page_idx").on(t.scopeId, t.id),
		index("org_enrollment_pending_scope_idx").on(t.scopeId, t.id).where(sql`${t.state}='pending'`),
		index("org_enrollment_subject_page_idx").on(t.recipientSubjectId, t.id),
		index("org_enrollment_pending_subject_idx")
			.on(t.recipientSubjectId, t.id)
			.where(sql`${t.state}='pending'`),
		index("org_enrollment_sender_pending_idx")
			.on(t.invitedByAuthUserId, t.id)
			.where(sql`${t.state}='pending'`),
		index("org_enrollment_expiry_idx").on(t.expiresAt, t.id).where(sql`${t.state}='pending'`),
		index("org_enrollment_contact_idx").on(t.contactId, t.id),
		index("org_enrollment_membership_generation_idx")
			.on(t.membershipId, t.generation)
			.where(sql`${t.membershipId} is not null`),
		foreignKey({
			name: "org_enrollment_exact_member_fk",
			columns: [t.membershipId, t.scopeId, t.recipientSubjectId],
			foreignColumns: [accessMembership.id, accessMembership.scopeId, accessMembership.subjectId],
		}),
		foreignKey({
			name: "org_enrollment_admission_fk",
			columns: [t.membershipId, t.generation],
			foreignColumns: [
				accessMembershipAdmission.membershipId,
				accessMembershipAdmission.generation,
			],
		}),
		check(
			"org_enrollment_revision_check",
			sql`${t.revision} between 1 and 9007199254740991 and ${t.organizationRevision}>0`,
		),
		check(
			"org_enrollment_state_check",
			sql`${t.state} in ('pending','accepted','declined','revoked','expired','invalidated')`,
		),
		check(
			"org_enrollment_expiry_check",
			sql`${t.expiresAt}>${t.createdAt} and ${t.expiresAt}<=${t.createdAt}+interval '30 days'`,
		),
		check(
			"org_enrollment_resolution_check",
			sql`(${t.state}='pending')=(${t.resolvedAt} is null) and ((${t.state}='accepted' and ${t.membershipId} is not null and ${t.generation}>0) or (${t.state}<>'accepted' and ${t.membershipId} is null and ${t.generation} is null))`,
		),
		check(
			"org_enrollment_evidence_budget",
			sql`(${t.state}<>'pending' or ${t.authority} is not null) and octet_length(${t.authority}::text)<=32768`,
		),
	],
);
/** Exact command receipts retain outcomes, not current authorization or expiring selectors. @internal */
export const organizationEnrollmentOperation = pgTable(
	"organization_enrollment_operation",
	{
		scopeId: uuid()
			.notNull()
			.references(() => accessScope.id),
		operationId: uuid().notNull(),
		operatorAuthUserId: uuid()
			.notNull()
			.references(() => users.id),
		authoritySubjectId: uuid()
			.notNull()
			.references(() => accessSubject.id),
		requestDigest: text().notNull(),
		invitationId: uuid().references(() => organizationEnrollmentInvitation.id),
		recipientSubjectId: uuid()
			.notNull()
			.references(() => accessSubject.id),
		result: jsonb()
			.$type<{
				entityId?: string;
				scopeId?: string;
				representation?: { id: string; revision: number };
				invitationId?: string;
				revision?: number;
				state?: (typeof OrganizationMembershipInvitationStateValues)[number];
				membershipId?: string;
				version?: number;
				activeGeneration?: number | null;
				lastGeneration?: number;
			}>()
			.notNull(),
		createdAt: createCreatedAtColumn(),
	},
	(t) => [
		primaryKey({ columns: [t.scopeId, t.operationId] }),
		index("org_enrollment_operation_subject_idx").on(t.recipientSubjectId, t.operationId),
		index("org_enrollment_operation_invitation_idx").on(t.invitationId),
		check("org_enrollment_operation_digest_check", sql`${t.requestDigest} ~ '^[0-9a-f]{64}$'`),
		check("org_enrollment_operation_result_budget", sql`octet_length(${t.result}::text)<=2048`),
	],
);
/** Due-indexed policy reconciliation for pending invitations; unavailable is retried without invalidation. @internal */
export const organizationEnrollmentReview = pgTable(
	"organization_enrollment_review",
	{
		invitationId: uuid()
			.primaryKey()
			.references(() => organizationEnrollmentInvitation.id, { onDelete: "cascade" }),
		dueAt: createTimestampMsColumn().notNull().defaultNow(),
	},
	(t) => [index("org_enrollment_review_due_idx").on(t.dueAt, t.invitationId)],
);
