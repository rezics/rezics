import { sql } from "drizzle-orm";
import { bigint, check, foreignKey, index, integer, jsonb, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { pgTable } from "./base";
import { createCreatedAtColumn, createUuidv7PrimaryKey } from "./columns";
import { accessMembership, accessMembershipAdmission } from "./access-membership";
import { accessGroup } from "./access-group";
import { users } from "./auth";
import { accessSubject } from "./access-identity";
import { accessAssignmentCeiling } from "./access-assignment-ceiling";

/** Change witnesses, including negative reverse-index reads; never logical identities or authority. @internal */
export const accessImpactFence = pgTable("access_impact_fence", {
	kind: text().notNull(), key: uuid().notNull(), version: bigint({ mode: "number" }).notNull().default(0),
	lastWriterXid: text(),
}, t => [primaryKey({ columns: [t.kind, t.key] }),
	check("access_impact_fence_kind_check", sql`${t.kind} in ('group','tree','binding-scope','membership','binding','role','ceiling','representation')`),
	check("access_impact_fence_writer_check", sql`(${t.version}=0 and ${t.lastWriterXid} is null) or (${t.version}>0 and ${t.lastWriterXid} is not null and ${t.lastWriterXid}::xid8>'0'::xid8)`),
	check("access_impact_fence_version_check", sql`${t.version} between 0 and 9007199254740991`)]);

/** Durable bounded discovery, bound to an exact proposal and private reviewer. No admission flag exists. @internal */
export const accessGroupImpactReview = pgTable("access_group_impact_review", {
	id: createUuidv7PrimaryKey(), scopeId: uuid().notNull(), groupId: uuid().notNull(),
	operatorAuthUserId: uuid().notNull().references(() => users.id, { onDelete: "restrict" }),
	authoritySubjectId: uuid().notNull().references(() => accessSubject.id, { onDelete: "restrict" }),
	operation: text().$type<"reparent" | "retire" | "assign" | "remove" | "prune">().notNull(), proposedParentId: uuid().references(() => accessGroup.id, { onDelete: "restrict" }),
	membershipId: uuid(), generation: bigint({ mode: "number" }), expectedSelectionVersion: bigint({ mode: "number" }),
	expectedGroupVersion: bigint({ mode: "number" }).notNull(), expectedTreeVersion: bigint({ mode: "number" }).notNull(),
	status: text().$type<"discovering" | "complete" | "invalidated" | "unavailable">().notNull().default("discovering"),
	reason: text().$type<"changed" | "expired" | "budget" | "missing">(),
	baseSnapshot: text().notNull(),
	witnessCount: integer().notNull().default(0),
	pageVersion: integer().notNull().default(0), nodeCount: integer().notNull().default(0), factCount: integer().notNull().default(0),
	workCount: integer().notNull().default(0), byteCount: integer().notNull().default(0),
	createdAt: createCreatedAtColumn(), expiresAt: timestamp({ withTimezone: true, precision: 3, mode: "date" }).notNull(),
	validUntil: timestamp({ withTimezone: true, precision: 3, mode: "date" }).notNull(),
}, t => [foreignKey({ columns: [t.membershipId, t.scopeId], foreignColumns: [accessMembership.id, accessMembership.scopeId] }).onDelete("restrict"),
	foreignKey({ columns: [t.membershipId, t.generation], foreignColumns: [accessMembershipAdmission.membershipId, accessMembershipAdmission.generation] }).onDelete("restrict"),
	check("access_group_impact_selection_check", sql`(${t.operation} in ('assign','remove','prune') and ${t.membershipId} is not null and ${t.generation} is not null and ${t.generation} between 1 and 9007199254740991 and ${t.expectedSelectionVersion} is not null and ${t.expectedSelectionVersion} between 0 and 9007199254740990) or (${t.operation} in ('reparent','retire') and ${t.membershipId} is null and ${t.generation} is null and ${t.expectedSelectionVersion} is null)`),
	foreignKey({ columns: [t.groupId, t.scopeId], foreignColumns: [accessGroup.id, accessGroup.scopeId] }).onDelete("restrict"),
	index("access_group_impact_expiry_idx").on(t.expiresAt, t.id),
	index("access_group_impact_reviewer_idx").on(t.operatorAuthUserId, t.expiresAt, t.id),
	check("access_group_impact_proposal_check", sql`${t.operation} in ('reparent','retire','assign','remove','prune') and (${t.operation}='reparent' or ${t.proposedParentId} is null) and ${t.expectedGroupVersion} between 1 and 9007199254740991 and ${t.expectedTreeVersion} between 0 and 9007199254740991`),
	check("access_group_impact_status_check", sql`(${t.status} in ('discovering','complete') and ${t.reason} is null) or (${t.status}='invalidated' and ${t.reason} is not null and ${t.reason} in ('changed','expired')) or (${t.status}='unavailable' and ${t.reason} is not null and ${t.reason} in ('budget','missing'))`),
	check("access_group_impact_budget_check", sql`${t.witnessCount} between 0 and 8193 and ${t.nodeCount} between 0 and 4096 and ${t.factCount} between 0 and 32768 and ${t.workCount} between 0 and 65536 and ${t.byteCount} between 0 and 16777216 and ${t.pageVersion} between 0 and 65536`),
	check("access_group_impact_snapshot_check", sql`octet_length(${t.baseSnapshot}) between 1 and 65536 and pg_snapshot_xmax(${t.baseSnapshot}::pg_snapshot)>=pg_snapshot_xmin(${t.baseSnapshot}::pg_snapshot)`),
	check("access_group_impact_time_check", sql`isfinite(${t.expiresAt}) and isfinite(${t.validUntil}) and ${t.validUntil}<=${t.expiresAt}`)]);

/** Server-owned resumable work; variant distinguishes affected descendants from supporting ancestors. @internal */
export const accessGroupImpactNode = pgTable("access_group_impact_node", {
	reviewId: uuid().notNull().references(() => accessGroupImpactReview.id, { onDelete: "cascade" }),
	kind: text().notNull(), key: uuid().notNull(), stage: integer().notNull().default(0), cursor: jsonb().$type<unknown[]>(),
	payload: jsonb().$type<Record<string, unknown>>(),
}, t => [primaryKey({ columns: [t.reviewId, t.kind, t.key] }),
	index("access_group_impact_pending_idx").on(t.reviewId, t.kind, t.key).where(sql`${t.stage}>=0`),
	check("access_group_impact_node_kind_check", sql`${t.kind} in ('roster','scope-roster','subtree','group','group-context','binding','binding-context','role','ceiling','representation','representation-context','membership')`),
	check("access_group_impact_node_stage_check", sql`${t.stage} between -1 and 16`)]);

/** Complete retained read set for bounded lock-and-revalidate; a missing fence is never version zero. @internal */
export const accessGroupImpactWitness = pgTable("access_group_impact_witness", {
	reviewId: uuid().notNull().references(() => accessGroupImpactReview.id, { onDelete: "cascade" }),
	kind: text().notNull(), key: uuid().notNull(), version: bigint({ mode: "number" }).notNull(),
}, t => [primaryKey({ columns: [t.reviewId, t.kind, t.key] }),
	foreignKey({ columns: [t.kind, t.key], foreignColumns: [accessImpactFence.kind, accessImpactFence.key] }).onDelete("restrict")]);

/** Private exact evidence; only random review-local item ids and coarse summaries leave the owner. @internal */
export const accessGroupImpactFact = pgTable("access_group_impact_fact", {
	id: createUuidv7PrimaryKey(), reviewId: uuid().notNull().references(() => accessGroupImpactReview.id, { onDelete: "cascade" }),
	ordinal: integer().notNull(), kind: text().notNull(), payload: jsonb().$type<Record<string, unknown>>().notNull(),
}, t => [uniqueIndex("access_group_impact_fact_page_key").on(t.reviewId, t.ordinal)]);

/** One server-owned evaluation per exact review; completion only certifies delta/ceiling work. @internal */
export const accessGroupImpactEvaluation = pgTable("access_group_impact_evaluation", {
	reviewId: uuid().primaryKey().references(() => accessGroupImpactReview.id, { onDelete: "cascade" }),
	status: text().$type<"evaluating" | "complete" | "denied" | "unavailable" | "invalidated">().notNull(),
	reason: text(), pageVersion: integer().notNull().default(0), cursor: integer().notNull().default(0),
	effectCount: integer().notNull().default(0), byteCount: integer().notNull().default(0),
	managerDigest: text().notNull(), effectDigest: text().notNull(),
}, t => [check("access_group_evaluation_status_check", sql`${t.status} in ('evaluating','complete','denied','unavailable','invalidated')`),
	check("access_group_evaluation_digest_check", sql`${t.managerDigest} ~ '^[0-9a-f]{64}$' and ${t.effectDigest} ~ '^[0-9a-f]{64}$'`),
	check("access_group_evaluation_completion_check", sql`${t.status}<>'complete' or (${t.cursor}=${t.effectCount} and ${t.reason} is null and ${t.byteCount}>0)`),
	check("access_group_evaluation_budget_check", sql`${t.cursor} between 0 and ${t.effectCount} and ${t.effectCount} between 0 and 4096 and ${t.byteCount} between 0 and 16777216 and ${t.pageVersion} between 0 and 4096`)]);

/** Complete source contributions and exact before/after paths, never a corpus-wide resource ACL. @internal */
export const accessGroupImpactEffect = pgTable("access_group_impact_effect", {
	id: createUuidv7PrimaryKey(), reviewId: uuid().notNull().references(() => accessGroupImpactEvaluation.reviewId, { onDelete: "cascade" }),
	ordinal: integer().notNull(), payload: jsonb().$type<Record<string, unknown>>().notNull(),
	decision: text().$type<"pending" | "not-required" | "covered" | "approval-required" | "denied" | "unavailable">().notNull().default("pending"),
	reason: text(), ceilingId: uuid().references(() => accessAssignmentCeiling.id, { onDelete: "restrict" }),
}, t => [uniqueIndex("access_group_impact_effect_page_key").on(t.reviewId,t.ordinal),
	check("access_group_impact_effect_ceiling_check", sql`(${t.decision}='covered')=(${t.ceilingId} is not null)`),
	check("access_group_impact_effect_ordinal_check", sql`${t.ordinal} between 1 and 4096`),
	check("access_group_impact_effect_decision_check", sql`${t.decision} in ('pending','not-required','covered','approval-required','denied','unavailable')`)]);
