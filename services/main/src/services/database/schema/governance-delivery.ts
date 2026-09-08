import { sql } from "drizzle-orm";
import { check, index, integer, primaryKey, smallint, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { pgTable } from "./base";
import { createCreatedAtColumn, createTimestampMsColumn, createUuidv7PrimaryKey } from "./columns";
import { users } from "./auth";
import { entityIdentity } from "./catalog-identity";
import { contentGovernanceAction, contentReviewCase, governancePostBinding } from "./governance";

/** A resumable enumeration of a case's immutable referral prefix, not an in-memory recipient list. */
export const governanceReportDelivery = pgTable("governance_report_delivery", {
	id: createUuidv7PrimaryKey(),
	caseId: uuid().notNull().references(() => contentReviewCase.id, { onDelete: "restrict" }),
	actionId: uuid().references(() => contentGovernanceAction.id, { onDelete: "restrict" }),
	publicNoticePostId: uuid().references(() => governancePostBinding.postId, { onDelete: "restrict" }),
	actorEntityId: uuid().notNull().references(() => entityIdentity.id, { onDelete: "restrict" }),
	actorAuthUserId: uuid().notNull().references(() => users.id, { onDelete: "restrict" }),
	kind: text({ enum: ["action", "dismissal", "notice"] }).notNull(),
	shard: smallint().notNull(),
	throughReferralId: uuid().notNull(),
	afterReferralId: uuid(),
	availableAt: createTimestampMsColumn().notNull().defaultNow(),
	failureCount: integer().notNull().default(0),
	lastError: text(),
	createdAt: createCreatedAtColumn(),
	completedAt: createTimestampMsColumn(),
}, table => [
	uniqueIndex("governance_report_delivery_action_key").on(table.actionId).where(sql`${table.actionId} is not null`),
	uniqueIndex("governance_report_delivery_dismissal_key").on(table.caseId).where(sql`${table.kind} = 'dismissal'`),
	uniqueIndex("governance_report_delivery_notice_key").on(table.publicNoticePostId).where(sql`${table.kind} = 'notice'`),
	index("governance_report_delivery_ready_idx").on(table.shard, table.availableAt, table.id).where(sql`${table.completedAt} is null`),
	index("governance_report_delivery_shard_idx").on(table.shard, table.id),
	index("governance_report_delivery_completed_idx").on(table.completedAt, table.id).where(sql`${table.completedAt} is not null`),
	index("governance_report_delivery_case_idx").on(table.caseId, table.id),
	index("governance_report_delivery_case_pending_idx").on(table.caseId).where(sql`${table.completedAt} is null`),
	index("governance_report_delivery_actor_idx").on(table.actorEntityId),
	index("governance_report_delivery_auth_idx").on(table.actorAuthUserId),
	index("governance_report_delivery_notice_idx").on(table.publicNoticePostId),
	check("governance_report_delivery_kind_check", sql`${table.kind} in ('action','dismissal','notice') and (${table.kind} = 'action') = (${table.actionId} is not null) and (${table.kind} <> 'notice' or ${table.publicNoticePostId} is not null)`),
	check("governance_report_delivery_shard_check", sql`${table.shard} between 0 and 63`),
	check("governance_report_delivery_cursor_check", sql`${table.afterReferralId} is null or ${table.afterReferralId} <= ${table.throughReferralId}`),
	check("governance_report_delivery_failure_check", sql`${table.failureCount} >= 0 and (${table.lastError} is null or octet_length(${table.lastError}) <= 2048)`),
]);

/** Auth-private read receipts avoid corpus-sized ACL arrays on popular moderation notices. */
export const governanceNoticeRecipient = pgTable("governance_notice_recipient", {
	postId: uuid().notNull().references(() => governancePostBinding.postId, { onDelete: "restrict" }),
	authUserId: uuid().notNull().references(() => users.id, { onDelete: "cascade" }),
	createdAt: createCreatedAtColumn(),
}, table => [
	primaryKey({ columns: [table.postId, table.authUserId], name: "governance_notice_recipient_pkey" }),
	index("governance_notice_recipient_auth_idx").on(table.authUserId, table.postId),
]);
