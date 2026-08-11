import { sql } from "drizzle-orm";
import {
	bigint,
	boolean,
	check,
	foreignKey,
	index,
	integer,
	jsonb,
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
	type UnitMergeEligibleKind,
	UnitMergeEligibleKindValues,
	type UnitMergeGraphAction,
	UnitMergeGraphActionValues,
	type UnitMergeGraphRole,
	UnitMergeGraphRoleValues,
	type UnitMergeOperationPhase,
	UnitMergeOperationPhaseValues,
	UnitMergeOperationStateValues,
	UnitMergeRequestModeValues,
	UnitMergeRequestStateValues,
	UnitMergeReviewDecisionValues,
	toEnumValues,
} from "./contract-values";
import {
	createCreatedAtColumn,
	createTimestampMsColumn,
	createUpdatedAtColumn,
	createUuidv7PrimaryKey,
} from "./columns";
import { governanceDecision } from "./governance";
import { profile } from "./profile";
import { unit } from "./unit";

export const unitMergeRequestMode = pgEnum(
	"unit_merge_request_mode",
	toEnumValues(UnitMergeRequestModeValues),
);
export const unitMergeRequestState = pgEnum(
	"unit_merge_request_state",
	toEnumValues(UnitMergeRequestStateValues),
);
export const unitMergeReviewDecision = pgEnum(
	"unit_merge_review_decision",
	toEnumValues(UnitMergeReviewDecisionValues),
);
export const unitMergeOperationState = pgEnum(
	"unit_merge_operation_state",
	toEnumValues(UnitMergeOperationStateValues),
);
export const unitMergeOperationPhase = pgEnum(
	"unit_merge_operation_phase",
	toEnumValues(UnitMergeOperationPhaseValues),
);

/** Immutable Variant-star rewrite selected by the accepted request manifest. */
export type UnitMergeGraphPlanV1 = {
	readonly version: 1;
	readonly sourceRole: UnitMergeGraphRole;
	readonly targetRole: UnitMergeGraphRole;
	readonly sourceMainUnitId: string | null;
	readonly targetMainUnitId: string | null;
	readonly destinationMainUnitId: string | null;
	readonly action: UnitMergeGraphAction;
};

export const unitMergeRequest = pgTable(
	"unit_merge_request",
	{
		id: createUuidv7PrimaryKey(),
		sourceUnitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "restrict" }),
		targetUnitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "restrict" }),
		unitKind: text().$type<UnitMergeEligibleKind>().notNull(),
		mode: unitMergeRequestMode().notNull(),
		state: unitMergeRequestState().notNull(),
		proposerProfileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "restrict" }),
		idempotencyKey: text().notNull(),
		overrideOfRequestId: uuid(),
		decisionId: uuid().references(() => governanceDecision.id, { onDelete: "restrict" }),
		note: text(),
		policyVersion: smallint().notNull(),
		requiredApprovals: smallint().notNull(),
		vetoEnabled: boolean().notNull(),
		selfReviewForbidden: boolean().notNull(),
		manifestVersion: smallint().notNull(),
		sourceUpdatedAt: createTimestampMsColumn().notNull(),
		targetUpdatedAt: createTimestampMsColumn().notNull(),
		sourceGraphRevision: bigint({ mode: "number" }).notNull(),
		targetGraphRevision: bigint({ mode: "number" }).notNull(),
		graphPlan: jsonb().$type<UnitMergeGraphPlanV1>().notNull(),
		requestFingerprint: text().notNull(),
		expiresAt: createTimestampMsColumn().notNull(),
		acceptedAt: createTimestampMsColumn(),
		rejectedAt: createTimestampMsColumn(),
		supersededAt: createTimestampMsColumn(),
		completedAt: createTimestampMsColumn(),
		failedAt: createTimestampMsColumn(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		foreignKey({
			columns: [table.overrideOfRequestId],
			foreignColumns: [table.id],
			name: "unit_merge_request_override_of_fkey",
		}).onDelete("restrict"),
		index("unit_merge_request_state_id_idx").on(table.state, table.id.desc()),
		index("unit_merge_request_source_created_idx").on(
			table.sourceUnitId,
			table.createdAt.desc(),
			table.id.desc(),
		),
		index("unit_merge_request_target_created_idx").on(
			table.targetUnitId,
			table.createdAt.desc(),
			table.id.desc(),
		),
		index("unit_merge_request_proposer_created_idx").on(
			table.proposerProfileId,
			table.createdAt.desc(),
			table.id.desc(),
		),
		unique("unit_merge_request_proposer_idempotency_key").on(
			table.proposerProfileId,
			table.idempotencyKey,
		),
		uniqueIndex("unit_merge_request_decision_key")
			.on(table.decisionId)
			.where(sql`${table.decisionId} is not null`),
		index("unit_merge_request_pending_expiry_idx")
			.on(table.expiresAt, table.id)
			.where(sql`${table.state} = 'pending_review'::unit_merge_request_state`),
		uniqueIndex("unit_merge_request_active_source_key")
			.on(table.sourceUnitId)
			.where(sql`${table.state} in ('pending_review', 'accepted', 'executing', 'failed')`),
		uniqueIndex("unit_merge_request_override_of_key")
			.on(table.overrideOfRequestId)
			.where(sql`${table.overrideOfRequestId} is not null`),
		check(
			"unit_merge_request_kind_check",
			sql`${table.unitKind} in (${sql.join(
				UnitMergeEligibleKindValues.map((kind) => sql`${kind}`),
				sql`, `,
			)})`,
		),
		check("unit_merge_request_not_self_check", sql`${table.sourceUnitId} <> ${table.targetUnitId}`),
		check("unit_merge_request_policy_version_check", sql`${table.policyVersion} > 0`),
		check("unit_merge_request_required_approvals_check", sql`${table.requiredApprovals} > 0`),
		check("unit_merge_request_manifest_version_check", sql`${table.manifestVersion} > 0`),
		check(
			"unit_merge_request_graph_revision_check",
			sql`${table.sourceGraphRevision} >= 0 and ${table.targetGraphRevision} >= 0`,
		),
		check(
			"unit_merge_request_graph_plan_check",
			sql`jsonb_typeof(${table.graphPlan}) = 'object'
				and (${table.graphPlan}->>'version') = '1'
				and (${table.graphPlan}->>'sourceRole') in (${sql.join(
					UnitMergeGraphRoleValues.map((role) => sql`${role}`),
					sql`, `,
				)})
				and (${table.graphPlan}->>'targetRole') in (${sql.join(
					UnitMergeGraphRoleValues.map((role) => sql`${role}`),
					sql`, `,
				)})
				and (${table.graphPlan}->>'action') in (${sql.join(
					UnitMergeGraphActionValues.map((action) => sql`${action}`),
					sql`, `,
				)})`,
		),
		check(
			"unit_merge_request_fingerprint_check",
			sql`${table.requestFingerprint} ~ '^[0-9a-f]{64}$'`,
		),
		check(
			"unit_merge_request_note_check",
			sql`${table.note} is null or btrim(${table.note}) <> ''`,
		),
		check(
			"unit_merge_request_idempotency_key_check",
			sql`btrim(${table.idempotencyKey}) <> '' and char_length(${table.idempotencyKey}) <= 200`,
		),
		check("unit_merge_request_expiry_check", sql`${table.expiresAt} > ${table.createdAt}`),
		check(
			"unit_merge_request_direct_state_check",
			sql`${table.mode} <> 'privileged_direct'::unit_merge_request_mode
				or ${table.state} <> 'pending_review'::unit_merge_request_state`,
		),
	],
);

/** One immutable decision per reviewer and request. */
export const unitMergeReview = pgTable(
	"unit_merge_review",
	{
		requestId: uuid()
			.notNull()
			.references(() => unitMergeRequest.id, { onDelete: "restrict" }),
		reviewerProfileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "restrict" }),
		decision: unitMergeReviewDecision().notNull(),
		note: text(),
		requestFingerprint: text().notNull(),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.requestId, table.reviewerProfileId] }),
		index("unit_merge_review_request_decision_idx").on(
			table.requestId,
			table.decision,
			table.createdAt,
			table.reviewerProfileId,
		),
		index("unit_merge_review_reviewer_created_idx").on(
			table.reviewerProfileId,
			table.createdAt.desc(),
			table.requestId,
		),
		check("unit_merge_review_note_check", sql`${table.note} is null or btrim(${table.note}) <> ''`),
		check(
			"unit_merge_review_fingerprint_check",
			sql`${table.requestFingerprint} ~ '^[0-9a-f]{64}$'`,
		),
	],
);

/** Stable redirect identity; chains are bounded and resolved transitively. */
export const unitMergeRedirect = pgTable(
	"unit_merge_redirect",
	{
		sourceUnitId: uuid()
			.primaryKey()
			.references(() => unit.id, { onDelete: "restrict" }),
		targetUnitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "restrict" }),
		maxDepth: smallint().default(1).notNull(),
		requestId: uuid()
			.notNull()
			.references(() => unitMergeRequest.id, { onDelete: "restrict" }),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		unique("unit_merge_redirect_request_key").on(table.requestId),
		index("unit_merge_redirect_target_depth_idx").on(
			table.targetUnitId,
			table.maxDepth.desc(),
			table.sourceUnitId,
		),
		check(
			"unit_merge_redirect_not_self_check",
			sql`${table.sourceUnitId} <> ${table.targetUnitId}`,
		),
		check("unit_merge_redirect_max_depth_check", sql`${table.maxDepth} between 1 and 32`),
	],
);

/** Monotonic Variant-star mutation clock used by immutable request manifests. */
export const unitMergeGraphGuard = pgTable(
	"unit_merge_graph_guard",
	{
		unitId: uuid()
			.primaryKey()
			.references(() => unit.id, { onDelete: "cascade" }),
		revision: bigint({ mode: "number" }).default(0).notNull(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [check("unit_merge_graph_guard_revision_check", sql`${table.revision} >= 0`)],
);

/** Retryable execution ledger; one worker lease advances one bounded phase. */
export const unitMergeOperation = pgTable(
	"unit_merge_operation",
	{
		id: createUuidv7PrimaryKey(),
		requestId: uuid()
			.notNull()
			.references(() => unitMergeRequest.id, { onDelete: "restrict" }),
		sourceUnitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "restrict" }),
		targetUnitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "restrict" }),
		state: unitMergeOperationState().default("pending").notNull(),
		phase: unitMergeOperationPhase().default("variant_graph").notNull(),
		attemptCount: integer().default(0).notNull(),
		processedRows: bigint({ mode: "number" }).default(0).notNull(),
		availableAt: createTimestampMsColumn().defaultNow().notNull(),
		leaseToken: uuid(),
		leaseExpiresAt: createTimestampMsColumn(),
		lastErrorCode: text(),
		lastErrorMessage: text(),
		startedAt: createTimestampMsColumn(),
		completedAt: createTimestampMsColumn(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		unique("unit_merge_operation_request_key").on(table.requestId),
		unique("unit_merge_operation_source_key").on(table.sourceUnitId),
		index("unit_merge_operation_claim_idx")
			.on(table.availableAt, table.createdAt, table.id)
			.where(sql`${table.state} in ('pending', 'retry_wait')`),
		index("unit_merge_operation_expired_lease_idx")
			.on(table.leaseExpiresAt, table.createdAt, table.id)
			.where(sql`${table.state} = 'processing'::unit_merge_operation_state`),
		index("unit_merge_operation_target_state_idx").on(
			table.targetUnitId,
			table.state,
			table.createdAt,
			table.id,
		),
		check(
			"unit_merge_operation_not_self_check",
			sql`${table.sourceUnitId} <> ${table.targetUnitId}`,
		),
		check("unit_merge_operation_attempt_check", sql`${table.attemptCount} >= 0`),
		check("unit_merge_operation_processed_rows_check", sql`${table.processedRows} >= 0`),
		check(
			"unit_merge_operation_lease_check",
			sql`(${table.state} = 'processing'::unit_merge_operation_state) = (${table.leaseExpiresAt} is not null and ${table.leaseToken} is not null)`,
		),
		check(
			"unit_merge_operation_error_check",
			sql`(${table.lastErrorCode} is null) = (${table.lastErrorMessage} is null)`,
		),
	],
);

/** Prevents Variant writes from changing an accepted graph plan before its phase completes. */
export const unitMergeGraphLock = pgTable(
	"unit_merge_graph_lock",
	{
		unitId: uuid()
			.primaryKey()
			.references(() => unit.id, { onDelete: "restrict" }),
		operationId: uuid()
			.notNull()
			.references(() => unitMergeOperation.id, { onDelete: "restrict" }),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [index("unit_merge_graph_lock_operation_idx").on(table.operationId, table.unitId)],
);

export type StoredUnitMergeOperationPhase = UnitMergeOperationPhase;
