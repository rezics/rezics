import { sql } from "drizzle-orm";
import {
	boolean,
	check,
	index,
	integer,
	jsonb,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { pgTable } from "../shared/base";
import { createCreatedAtColumn } from "../shared/columns";
import { accessScope, accessSubject } from "./access-identity";
import { users } from "../identity/auth";

/** Exact private proposal and complete bounded source digest; inspection never grants authority. @internal */
export const accessAssignmentReview = pgTable(
	"access_assignment_review",
	{
		id: uuid().primaryKey(),
		scopeId: uuid()
			.notNull()
			.references(() => accessScope.id, { onDelete: "restrict" }),
		principalId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		subjectId: uuid()
			.notNull()
			.references(() => accessSubject.id, { onDelete: "restrict" }),
		proof: jsonb().$type<Record<string, unknown>>().notNull(),
		selection: jsonb().$type<Record<string, unknown>>().notNull(),
		command: jsonb().$type<Record<string, unknown>>().notNull(),
		proposalDigest: text().notNull(),
		sourceDigest: text().notNull(),
		effectDigest: text().notNull(),
		evidence: jsonb().$type<Record<string, unknown>>().notNull(),
		effectCount: integer().notNull(),
		requiresApproval: boolean().notNull(),
		createdAt: createCreatedAtColumn(),
		baseSnapshot: text().notNull().default(sql`pg_current_snapshot()::text`),
		validUntil: timestamp({ withTimezone: true, precision: 3, mode: "date" }).notNull(),
	},
	(t) => [
		index("access_assignment_review_principal_idx").on(t.principalId, t.validUntil, t.id),
		check(
			"access_assignment_review_budget_check",
			sql`octet_length(${t.proof}::text)<=1024 and octet_length(${t.selection}::text)<=8192 and octet_length(${t.command}::text)<=65536 and octet_length(${t.evidence}::text)<=16777216 and ${t.effectCount} between 0 and 4096`,
		),
		check(
			"access_assignment_review_digest_check",
			sql`${t.proposalDigest} ~ '^[0-9a-f]{64}$' and ${t.sourceDigest} ~ '^[0-9a-f]{64}$' and ${t.effectDigest} ~ '^[0-9a-f]{64}$'`,
		),
		check(
			"access_assignment_review_time_check",
			sql`isfinite(${t.validUntil}) and ${t.validUntil}>${t.createdAt}`,
		),
	],
);

/** One independent principal acknowledges the complete proposal; private proof stays server-side. @internal */
export const accessAssignmentApproval = pgTable(
	"access_assignment_approval",
	{
		id: uuid().primaryKey(),
		reviewId: uuid()
			.notNull()
			.references(() => accessAssignmentReview.id, { onDelete: "restrict" }),
		principalId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		subjectId: uuid()
			.notNull()
			.references(() => accessSubject.id, { onDelete: "restrict" }),
		proof: jsonb().$type<Record<string, unknown>>().notNull(),
		selection: jsonb().$type<Record<string, unknown>>().notNull(),
		sourceDigest: text().notNull(),
		proposalDigest: text().notNull(),
		effectDigest: text().notNull(),
		createdAt: createCreatedAtColumn(),
		validUntil: timestamp({ withTimezone: true, precision: 3, mode: "date" }).notNull(),
		revokedAt: timestamp({ withTimezone: true, precision: 3, mode: "date" }),
		revokeOperationId: uuid(),
	},
	(t) => [
		uniqueIndex("access_assignment_approval_principal_key").on(t.reviewId, t.principalId),
		check(
			"access_assignment_approval_payload_check",
			sql`octet_length(${t.proof}::text)<=1024 and octet_length(${t.selection}::text)<=8192`,
		),
		check(
			"access_assignment_approval_digest_check",
			sql`${t.sourceDigest} ~ '^[0-9a-f]{64}$' and ${t.proposalDigest} ~ '^[0-9a-f]{64}$' and ${t.effectDigest} ~ '^[0-9a-f]{64}$'`,
		),
		check(
			"access_assignment_approval_time_check",
			sql`isfinite(${t.validUntil}) and ${t.validUntil}>${t.createdAt} and (${t.revokedAt} is null)=(${t.revokeOperationId} is null)`,
		),
	],
);

/** Historical admitted operation remains available after role, binding or ceiling retirement. @internal */
export const accessAssignmentReceipt = pgTable(
	"access_assignment_receipt",
	{
		reviewId: uuid()
			.primaryKey()
			.references(() => accessAssignmentReview.id, { onDelete: "restrict" }),
		operationId: uuid().notNull().unique(),
		proposalDigest: text().notNull(),
		effectDigest: text().notNull(),
		receipt: jsonb().$type<Record<string, unknown>>().notNull(),
		approvalIds: jsonb().$type<string[]>().notNull(),
		recoveryPathIds: jsonb().$type<string[]>().notNull(),
		createdAt: createCreatedAtColumn(),
	},
	(t) => [
		check(
			"access_assignment_receipt_budget_check",
			sql`octet_length(${t.receipt}::text)<=4096 and jsonb_array_length(${t.approvalIds})<=1 and jsonb_array_length(${t.recoveryPathIds})<=64`,
		),
	],
);
