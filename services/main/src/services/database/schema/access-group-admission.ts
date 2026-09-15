import { sql } from "drizzle-orm";
import { bigint, check, foreignKey, index, jsonb, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { pgTable } from "./base";
import { createCreatedAtColumn } from "./columns";
import { accessScope, accessSubject } from "./access-identity";
import { accessGroupImpactReview } from "./access-group-impact";
import { accessGroupMembershipEvent } from "./access-group-membership";
import { accessGroupEvent } from "./access-group";
import { users } from "./auth";

/** Fixed protected-continuity policy; enrolled paths supply evidence, never grants. @internal */
export const accessRecoveryPolicy = pgTable("access_recovery_policy", {
 scopeId: uuid().primaryKey().references(() => accessScope.id, { onDelete: "restrict" }),
 version: bigint({ mode: "number" }).notNull().default(1),
 policy: text().notNull().default("native-repair-v1"),
}, t => [check("access_recovery_policy_check", sql`${t.version} between 1 and 9007199254740991 and ${t.policy}='native-repair-v1'`)]);

/** Private bounded, expiring pre-change recovery candidates, authenticated by their own operator. @internal */
export const accessRecoveryPath = pgTable("access_recovery_path", {
 id: uuid().primaryKey(), scopeId: uuid().notNull().references(() => accessRecoveryPolicy.scopeId, { onDelete: "restrict" }),
 principalId: uuid().notNull().references(() => users.id, { onDelete: "restrict" }),
 subjectId: uuid().notNull().references(() => accessSubject.id, { onDelete: "restrict" }),
 proof: jsonb().$type<Record<string, unknown>>().notNull(), selection: jsonb().$type<Record<string, unknown>>().notNull(),
 sourceDigest: text().notNull(), requestDigest: text().notNull(), createdAt: createCreatedAtColumn(),
 createdXid: text().notNull().default(sql`pg_current_xact_id()::text`),
 validUntil: timestamp({ withTimezone: true, precision: 3, mode: "date" }).notNull(),
 revokedAt: timestamp({ withTimezone: true, precision: 3, mode: "date" }), revokeOperationId: uuid(),
}, t => [index("access_recovery_path_scope_idx").on(t.scopeId,t.validUntil,t.id).where(sql`${t.revokedAt} is null`),
 index("access_recovery_path_expiry_idx").on(t.validUntil,t.id),
 check("access_recovery_path_xid_check", sql`${t.createdXid}::xid8>'0'::xid8`),
 check("access_recovery_path_time_check", sql`isfinite(${t.validUntil}) and ${t.validUntil}>${t.createdAt} and (${t.revokedAt} is null)=(${t.revokeOperationId} is null)`),
 check("access_recovery_path_digest_check", sql`${t.sourceDigest} ~ '^[0-9a-f]{64}$' and ${t.requestDigest} ~ '^[0-9a-f]{64}$'`),
 check("access_recovery_path_payload_check", sql`octet_length(${t.proof}::text)<=1024 and octet_length(${t.selection}::text)<=8192`)]);

/** A single private accountable principal approves one exact proposal/effect/source set once. @internal */
export const accessGroupApproval = pgTable("access_group_approval", {
 id: uuid().primaryKey(), reviewId: uuid().notNull().references(() => accessGroupImpactReview.id, { onDelete: "restrict" }),
 principalId: uuid().notNull().references(() => users.id, { onDelete: "restrict" }),
 subjectId: uuid().notNull().references(() => accessSubject.id, { onDelete: "restrict" }),
 proof: jsonb().$type<Record<string, unknown>>().notNull(), selection: jsonb().$type<Record<string, unknown>>().notNull(),
 proposalDigest: text().notNull(), effectDigest: text().notNull(), sourceDigest: text().notNull(), witnessDigest: text().notNull(),
 createdAt: createCreatedAtColumn(), validUntil: timestamp({ withTimezone: true, precision: 3, mode: "date" }).notNull(),
 revokedAt: timestamp({ withTimezone: true, precision: 3, mode: "date" }), revokeOperationId: uuid(),
}, t => [uniqueIndex("access_group_approval_principal_key").on(t.reviewId,t.principalId),
 check("access_group_approval_time_check", sql`isfinite(${t.validUntil}) and ${t.validUntil}>${t.createdAt} and (${t.revokedAt} is null)=(${t.revokeOperationId} is null)`),
 check("access_group_approval_digest_check", sql`${t.proposalDigest} ~ '^[0-9a-f]{64}$' and ${t.effectDigest} ~ '^[0-9a-f]{64}$' and ${t.sourceDigest} ~ '^[0-9a-f]{64}$' and ${t.witnessDigest} ~ '^[0-9a-f]{64}$'`),
 check("access_group_approval_payload_check", sql`octet_length(${t.proof}::text)<=1024 and octet_length(${t.selection}::text)<=8192`)]);

/** Immutable admission attribution retained independently of disposable discovery evidence. @internal */
export const accessGroupAdmissionReceipt = pgTable("access_group_admission_receipt", {
 operationId: uuid().primaryKey(), groupId: uuid().notNull(), reviewId: uuid().notNull(),
 membershipId: uuid(), generation: bigint({ mode: "number" }),
 groupOperationId: uuid().generatedAlwaysAs(sql`case when membership_id is null then operation_id else null end`),
 proposalDigest: text().notNull(), effectDigest: text().notNull(),
 approvalIds: jsonb().$type<string[]>().notNull(), recoveryPathIds: jsonb().$type<string[]>().notNull(), createdAt: createCreatedAtColumn(),
}, t => [foreignKey({ name: "access_group_admission_receipt_0o7aOReEQy7V_fkey", columns: [t.groupId,t.groupOperationId],foreignColumns: [accessGroupEvent.groupId,accessGroupEvent.operationId] }).onDelete("restrict"),
 foreignKey({ columns: [t.membershipId,t.generation,t.groupId,t.operationId],foreignColumns: [accessGroupMembershipEvent.membershipId,accessGroupMembershipEvent.generation,accessGroupMembershipEvent.groupId,accessGroupMembershipEvent.operationId] }).onDelete("restrict"),
 check("access_group_admission_selection_check", sql`(${t.membershipId} is null and ${t.generation} is null) or (${t.membershipId} is not null and ${t.generation} is not null and ${t.generation} between 1 and 9007199254740991)`),
 uniqueIndex("access_group_admission_review_key").on(t.reviewId),
 check("access_group_admission_receipt_budget_check", sql`jsonb_array_length(${t.approvalIds}) between 1 and 64 and jsonb_array_length(${t.recoveryPathIds}) between 1 and 64`)]);
