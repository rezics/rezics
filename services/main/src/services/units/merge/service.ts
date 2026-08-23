import { and, desc, eq, inArray, lt, lte, sql } from "drizzle-orm";

import {
	UnitMergeIdempotencyConflict,
	UnitMergeManifestStale,
	UnitMergeNotFound,
	UnitMergeRequestConflict,
	UnitMergeRequestExpired,
	UnitMergeRequestNotPending,
	UnitMergeRetryUnavailable,
	UnitMergeReviewDuplicate,
	UnitMergeReviewFingerprintMismatch,
	UnitMergeReviewSelfForbidden,
} from "../../api/governance/errors";
import { recordAuditEvent } from "../../audit";
import { database, type DatabaseExecutor, type DatabaseTransaction } from "../../database";
import { databaseConstraintName } from "../../database/constraint";
import { runVndbVoteTransaction } from "../../database/vndb-vote-admission";
import {
	unit,
	governanceDecisionRule,
	unitMergeGraphLock,
	unitMergeOperation,
	unitMergeRedirect,
	unitMergeRequest,
	unitMergeReview,
	type UnitMergeEligibleKind,
	type UnitMergeGraphPlanV1,
	type UnitMergeOperationPhase,
	type UnitMergeOperationState,
	type UnitMergeRequestMode,
	type UnitMergeRequestState,
	type UnitMergeReviewDecision,
} from "../../database/schema";
import {
	createGovernanceDecision,
	listGovernanceDecisionRules,
	validateGovernanceRuleReferences,
	type GovernanceRuleReference,
} from "../../governance/decision-service";
import { firstUnitLocalizationTitle } from "../localization";
import { UnitNotFound } from "../errors";
import { isEntityMeasurementMergePhase } from "./entity-measurements";
import {
	buildUnitMergeManifest,
	requireCurrentUnitMergeManifest,
	type UnitMergeManifestV1,
} from "./manifest";
import { UnitMergePolicyV1, unitMergeRequestExpiry } from "./policy";

export type UnitMergeReviewView = {
	readonly reviewerProfileId: string;
	readonly reviewerLabel: string | null;
	readonly decision: UnitMergeReviewDecision;
	readonly note: string | null;
	readonly createdAt: Date;
};

export type UnitMergeRequestView = {
	readonly id: string;
	readonly sourceUnit: { readonly id: string; readonly title: string | null };
	readonly targetUnit: { readonly id: string; readonly title: string | null };
	readonly unitKind: UnitMergeEligibleKind;
	readonly mode: UnitMergeRequestMode;
	readonly state: UnitMergeRequestState;
	readonly proposer: { readonly profileId: string; readonly label: string | null };
	readonly overrideOfRequestId: string | null;
	readonly rules: GovernanceRuleReference[];
	readonly note: string | null;
	readonly policy: {
		readonly version: number;
		readonly requiredApprovals: number;
		readonly vetoEnabled: boolean;
		readonly selfReviewForbidden: boolean;
	};
	readonly manifest: {
		readonly version: 1;
		readonly sourceUpdatedAt: Date;
		readonly targetUpdatedAt: Date;
		readonly sourceGraphRevision: number;
		readonly targetGraphRevision: number;
		readonly graphPlan: UnitMergeGraphPlanV1;
		readonly fingerprint: string;
	};
	readonly approvals: number;
	readonly rejections: number;
	readonly reviews: UnitMergeReviewView[];
	readonly operation: null | {
		readonly id: string;
		readonly state: UnitMergeOperationState;
		readonly phase: UnitMergeOperationPhase;
		readonly attemptCount: number;
		readonly processedRows: number;
		readonly availableAt: Date;
		readonly lastErrorCode: string | null;
		readonly lastErrorMessage: string | null;
		readonly startedAt: Date | null;
		readonly completedAt: Date | null;
	};
	readonly expiresAt: Date;
	readonly acceptedAt: Date | null;
	readonly rejectedAt: Date | null;
	readonly supersededAt: Date | null;
	readonly completedAt: Date | null;
	readonly failedAt: Date | null;
	readonly createdAt: Date;
	readonly updatedAt: Date;
};

const requestSelection = {
	id: unitMergeRequest.id,
	sourceUnitId: unitMergeRequest.sourceUnitId,
	sourceTitle: firstUnitLocalizationTitle(unitMergeRequest.sourceUnitId),
	targetUnitId: unitMergeRequest.targetUnitId,
	targetTitle: firstUnitLocalizationTitle(unitMergeRequest.targetUnitId),
	unitKind: unitMergeRequest.unitKind,
	mode: unitMergeRequest.mode,
	state: unitMergeRequest.state,
	proposerProfileId: unitMergeRequest.proposerProfileId,
	proposerLabel: firstUnitLocalizationTitle(unitMergeRequest.proposerProfileId),
	overrideOfRequestId: unitMergeRequest.overrideOfRequestId,
	decisionId: unitMergeRequest.decisionId,
	note: unitMergeRequest.note,
	policyVersion: unitMergeRequest.policyVersion,
	requiredApprovals: unitMergeRequest.requiredApprovals,
	vetoEnabled: unitMergeRequest.vetoEnabled,
	selfReviewForbidden: unitMergeRequest.selfReviewForbidden,
	manifestVersion: unitMergeRequest.manifestVersion,
	sourceUpdatedAt: unitMergeRequest.sourceUpdatedAt,
	targetUpdatedAt: unitMergeRequest.targetUpdatedAt,
	sourceGraphRevision: unitMergeRequest.sourceGraphRevision,
	targetGraphRevision: unitMergeRequest.targetGraphRevision,
	graphPlan: unitMergeRequest.graphPlan,
	requestFingerprint: unitMergeRequest.requestFingerprint,
	expiresAt: unitMergeRequest.expiresAt,
	acceptedAt: unitMergeRequest.acceptedAt,
	rejectedAt: unitMergeRequest.rejectedAt,
	supersededAt: unitMergeRequest.supersededAt,
	completedAt: unitMergeRequest.completedAt,
	failedAt: unitMergeRequest.failedAt,
	createdAt: unitMergeRequest.createdAt,
	updatedAt: unitMergeRequest.updatedAt,
	operationId: unitMergeOperation.id,
	operationState: unitMergeOperation.state,
	operationPhase: unitMergeOperation.phase,
	operationAttemptCount: unitMergeOperation.attemptCount,
	operationProcessedRows: unitMergeOperation.processedRows,
	operationAvailableAt: unitMergeOperation.availableAt,
	operationLastErrorCode: unitMergeOperation.lastErrorCode,
	operationLastErrorMessage: unitMergeOperation.lastErrorMessage,
	operationStartedAt: unitMergeOperation.startedAt,
	operationCompletedAt: unitMergeOperation.completedAt,
};

type SelectedRequest = Awaited<ReturnType<typeof selectRequests>>[number];

function requireUnitMergeManifestVersion(value: number): 1 {
	if (value !== UnitMergePolicyV1.manifestVersion)
		throw new Error(`Unsupported Unit merge manifest version ${value}`);
	return value;
}

async function selectRequests(
	executor: DatabaseExecutor,
	where: ReturnType<typeof eq> | undefined,
	limit: number,
) {
	return executor
		.select(requestSelection)
		.from(unitMergeRequest)
		.leftJoin(unitMergeOperation, eq(unitMergeOperation.requestId, unitMergeRequest.id))
		.where(where)
		.orderBy(desc(unitMergeRequest.id))
		.limit(limit);
}

async function presentRequests(
	executor: DatabaseExecutor,
	rows: readonly SelectedRequest[],
): Promise<UnitMergeRequestView[]> {
	const ids = rows.map((row) => row.id);
	const reviews = ids.length
		? await executor
				.select({
					requestId: unitMergeReview.requestId,
					reviewerProfileId: unitMergeReview.reviewerProfileId,
					reviewerLabel: firstUnitLocalizationTitle(unitMergeReview.reviewerProfileId),
					decision: unitMergeReview.decision,
					note: unitMergeReview.note,
					createdAt: unitMergeReview.createdAt,
				})
				.from(unitMergeReview)
				.where(inArray(unitMergeReview.requestId, ids))
				.orderBy(unitMergeReview.createdAt, unitMergeReview.reviewerProfileId)
		: [];
	const byRequest = new Map<string, UnitMergeReviewView[]>();
	for (const review of reviews) {
		const items = byRequest.get(review.requestId) ?? [];
		items.push({
			reviewerProfileId: review.reviewerProfileId,
			reviewerLabel: review.reviewerLabel,
			decision: review.decision,
			note: review.note,
			createdAt: review.createdAt,
		});
		byRequest.set(review.requestId, items);
	}
	const decisionIds = [...new Set(rows.flatMap((row) => (row.decisionId ? [row.decisionId] : [])))];
	const ruleRows = decisionIds.length
		? await executor
				.select({
					decisionId: governanceDecisionRule.decisionId,
					sourceRealmId: governanceDecisionRule.ruleSourceRealmId,
					revisionId: governanceDecisionRule.ruleRevisionId,
					ruleId: governanceDecisionRule.ruleId,
				})
				.from(governanceDecisionRule)
				.where(inArray(governanceDecisionRule.decisionId, decisionIds))
				.orderBy(
					governanceDecisionRule.decisionId,
					governanceDecisionRule.ruleSourceRealmId,
					governanceDecisionRule.ruleId,
				)
		: [];
	const rulesByDecision = new Map<string, GovernanceRuleReference[]>();
	for (const rule of ruleRows) {
		const items = rulesByDecision.get(rule.decisionId) ?? [];
		items.push({
			sourceRealmId: rule.sourceRealmId,
			revisionId: rule.revisionId,
			ruleId: rule.ruleId,
		});
		rulesByDecision.set(rule.decisionId, items);
	}
	return rows.map((row) => {
		const requestReviews = byRequest.get(row.id) ?? [];
		return {
			id: row.id,
			sourceUnit: { id: row.sourceUnitId, title: row.sourceTitle },
			targetUnit: { id: row.targetUnitId, title: row.targetTitle },
			unitKind: row.unitKind,
			mode: row.mode,
			state: row.state,
			proposer: { profileId: row.proposerProfileId, label: row.proposerLabel },
			overrideOfRequestId: row.overrideOfRequestId,
			rules: row.decisionId ? (rulesByDecision.get(row.decisionId) ?? []) : [],
			note: row.note,
			policy: {
				version: row.policyVersion,
				requiredApprovals: row.requiredApprovals,
				vetoEnabled: row.vetoEnabled,
				selfReviewForbidden: row.selfReviewForbidden,
			},
			manifest: {
				version: requireUnitMergeManifestVersion(row.manifestVersion),
				sourceUpdatedAt: row.sourceUpdatedAt,
				targetUpdatedAt: row.targetUpdatedAt,
				sourceGraphRevision: row.sourceGraphRevision,
				targetGraphRevision: row.targetGraphRevision,
				graphPlan: row.graphPlan,
				fingerprint: row.requestFingerprint,
			},
			approvals: requestReviews.filter(({ decision }) => decision === "approve").length,
			rejections: requestReviews.filter(({ decision }) => decision === "reject").length,
			reviews: requestReviews,
			operation:
				row.operationId &&
				row.operationState &&
				row.operationPhase &&
				row.operationAttemptCount !== null &&
				row.operationProcessedRows !== null &&
				row.operationAvailableAt
					? {
							id: row.operationId,
							state: row.operationState,
							phase: row.operationPhase,
							attemptCount: row.operationAttemptCount,
							processedRows: row.operationProcessedRows,
							availableAt: row.operationAvailableAt,
							lastErrorCode: row.operationLastErrorCode,
							lastErrorMessage: row.operationLastErrorMessage,
							startedAt: row.operationStartedAt,
							completedAt: row.operationCompletedAt,
						}
					: null,
			expiresAt: row.expiresAt,
			acceptedAt: row.acceptedAt,
			rejectedAt: row.rejectedAt,
			supersededAt: row.supersededAt,
			completedAt: row.completedAt,
			failedAt: row.failedAt,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
		};
	});
}

export async function getUnitMergeRequest(requestId: string): Promise<UnitMergeRequestView> {
	const rows = await selectRequests(database, eq(unitMergeRequest.id, requestId), 1);
	const [request] = await presentRequests(database, rows);
	if (!request) throw new UnitMergeNotFound();
	return request;
}

export async function listUnitMergeRequests(input: {
	readonly state?: UnitMergeRequestState;
	readonly cursor?: string;
	readonly limit: number;
}) {
	const rows = await selectRequests(
		database,
		and(
			input.state ? eq(unitMergeRequest.state, input.state) : undefined,
			input.cursor ? lt(unitMergeRequest.id, input.cursor) : undefined,
		),
		input.limit + 1,
	);
	const page = rows.slice(0, input.limit);
	return {
		items: await presentRequests(database, page),
		nextCursor: rows.length > input.limit ? (page.at(-1)?.id ?? null) : null,
	};
}

export async function preflightUnitMerge(input: {
	readonly sourceUnitId: string;
	readonly targetUnitId: string;
}) {
	const manifest = await runVndbVoteTransaction(
		{ family: "unit_merge", authority: "global" },
		(tx) => buildUnitMergeManifest(tx, input),
	);
	const rows = await database
		.select({ id: unit.id, title: firstUnitLocalizationTitle(unit.id) })
		.from(unit)
		.where(inArray(unit.id, [manifest.sourceUnitId, manifest.targetUnitId]));
	const titleById = new Map(rows.map((row) => [row.id, row.title]));
	return {
		sourceUnit: {
			id: manifest.sourceUnitId,
			title: titleById.get(manifest.sourceUnitId) ?? null,
		},
		targetUnit: {
			id: manifest.targetUnitId,
			title: titleById.get(manifest.targetUnitId) ?? null,
		},
		unitKind: manifest.unitKind,
		policy: {
			version: UnitMergePolicyV1.version,
			requiredApprovals: UnitMergePolicyV1.requiredApprovals,
			vetoEnabled: UnitMergePolicyV1.vetoEnabled,
			selfReviewForbidden: UnitMergePolicyV1.selfReviewForbidden,
		},
		manifest: {
			version: manifest.version,
			sourceUpdatedAt: manifest.sourceUpdatedAt,
			targetUpdatedAt: manifest.targetUpdatedAt,
			sourceGraphRevision: manifest.sourceGraphRevision,
			targetGraphRevision: manifest.targetGraphRevision,
			graphPlan: manifest.graphPlan,
			fingerprint: manifest.requestFingerprint,
		},
	};
}

type CreateMergeInput = {
	readonly sourceUnitId: string;
	readonly targetUnitId: string;
	readonly expectedSourceUpdatedAt: Date;
	readonly expectedTargetUpdatedAt: Date;
	readonly proposerProfileId: string;
	readonly idempotencyKey: string;
	readonly rules: readonly GovernanceRuleReference[];
	readonly note?: string;
};

function requestInsertValues(
	manifest: UnitMergeManifestV1,
	input: CreateMergeInput,
	requestId: string,
	decisionId: string,
	mode: UnitMergeRequestMode,
	state: UnitMergeRequestState,
	now: Date,
) {
	return {
		id: requestId,
		decisionId,
		sourceUnitId: manifest.sourceUnitId,
		targetUnitId: manifest.targetUnitId,
		unitKind: manifest.unitKind,
		mode,
		state,
		proposerProfileId: input.proposerProfileId,
		idempotencyKey: input.idempotencyKey,
		note: input.note,
		policyVersion: UnitMergePolicyV1.version,
		requiredApprovals: UnitMergePolicyV1.requiredApprovals,
		vetoEnabled: UnitMergePolicyV1.vetoEnabled,
		selfReviewForbidden: UnitMergePolicyV1.selfReviewForbidden,
		manifestVersion: UnitMergePolicyV1.manifestVersion,
		sourceUpdatedAt: manifest.sourceUpdatedAt,
		targetUpdatedAt: manifest.targetUpdatedAt,
		sourceGraphRevision: manifest.sourceGraphRevision,
		targetGraphRevision: manifest.targetGraphRevision,
		graphPlan: manifest.graphPlan,
		requestFingerprint: manifest.requestFingerprint,
		expiresAt: unitMergeRequestExpiry(now),
		createdAt: now,
		updatedAt: now,
	};
}

function canonicalRuleKeys(rules: readonly GovernanceRuleReference[]): string[] {
	return rules.map((rule) => `${rule.sourceRealmId}:${rule.revisionId}:${rule.ruleId}`).sort();
}

async function existingCommandMatches(
	executor: DatabaseExecutor,
	row: typeof unitMergeRequest.$inferSelect,
	input: CreateMergeInput & { readonly overrideOfRequestId?: string },
	mode: UnitMergeRequestMode,
): Promise<boolean> {
	if (!row.decisionId) return false;
	const existingRules = await listGovernanceDecisionRules(executor, row.decisionId);
	return (
		row.mode === mode &&
		row.sourceUnitId === input.sourceUnitId &&
		row.targetUnitId === input.targetUnitId &&
		row.sourceUpdatedAt.getTime() === input.expectedSourceUpdatedAt.getTime() &&
		row.targetUpdatedAt.getTime() === input.expectedTargetUpdatedAt.getTime() &&
		JSON.stringify(canonicalRuleKeys(existingRules)) ===
			JSON.stringify(canonicalRuleKeys(input.rules)) &&
		row.note === (input.note ?? null) &&
		row.overrideOfRequestId === (input.overrideOfRequestId ?? null)
	);
}

async function existingIdempotentRequest(
	executor: DatabaseExecutor,
	input: CreateMergeInput & { readonly overrideOfRequestId?: string },
	mode: UnitMergeRequestMode,
): Promise<string | null> {
	const [existing] = await executor
		.select()
		.from(unitMergeRequest)
		.where(
			and(
				eq(unitMergeRequest.proposerProfileId, input.proposerProfileId),
				eq(unitMergeRequest.idempotencyKey, input.idempotencyKey),
			),
		)
		.limit(1);
	if (!existing) return null;
	if (!(await existingCommandMatches(executor, existing, input, mode)))
		throw new UnitMergeIdempotencyConflict();
	return existing.id;
}

async function expirePendingMergeForSource(
	tx: DatabaseTransaction,
	sourceUnitId: string,
	now: Date,
): Promise<void> {
	await tx
		.update(unitMergeRequest)
		.set({ state: "expired", updatedAt: now })
		.where(
			and(
				eq(unitMergeRequest.sourceUnitId, sourceUnitId),
				eq(unitMergeRequest.state, "pending_review"),
				lte(unitMergeRequest.expiresAt, now),
			),
		);
}

async function auditMerge(
	tx: DatabaseTransaction,
	input: {
		readonly action: string;
		readonly actorProfileId: string;
		readonly requestId: string;
		readonly sourceUnitId: string;
		readonly targetUnitId: string;
		readonly governanceDecisionId?: string;
		readonly details?: Record<string, unknown>;
	},
): Promise<void> {
	await recordAuditEvent(tx, {
		category: "admin_activity",
		outcome: "succeeded",
		actor: { kind: "profile", profileId: input.actorProfileId },
		authority: { kind: "platform" },
		action: input.action,
		governanceDecisionId: input.governanceDecisionId,
		target: { kind: "unit_merge_request", id: input.requestId },
		details: {
			sourceUnitId: input.sourceUnitId,
			targetUnitId: input.targetUnitId,
			...input.details,
		},
	});
}

function graphLockUnitIds(
	sourceUnitId: string,
	targetUnitId: string,
	plan: UnitMergeGraphPlanV1,
): string[] {
	return [
		...new Set(
			[
				sourceUnitId,
				targetUnitId,
				plan.sourceMainUnitId,
				plan.targetMainUnitId,
				plan.destinationMainUnitId,
			].filter((unitId): unitId is string => Boolean(unitId)),
		),
	].sort();
}

async function acceptUnitMerge(
	tx: DatabaseTransaction,
	input: {
		readonly requestId: string;
		readonly sourceUnitId: string;
		readonly targetUnitId: string;
		readonly graphPlan: UnitMergeGraphPlanV1;
		readonly actorProfileId: string;
		readonly governanceDecisionId: string;
		readonly mode: UnitMergeRequestMode;
		readonly now: Date;
	},
): Promise<string> {
	const rules = await listGovernanceDecisionRules(tx, input.governanceDecisionId);
	await validateGovernanceRuleReferences(tx, {
		authority: { kind: "platform" },
		rules,
	});
	const [operation] = await tx
		.insert(unitMergeOperation)
		.values({
			requestId: input.requestId,
			sourceUnitId: input.sourceUnitId,
			targetUnitId: input.targetUnitId,
			availableAt: input.now,
			createdAt: input.now,
			updatedAt: input.now,
		})
		.returning({ id: unitMergeOperation.id });
	if (!operation) throw new Error("Accepted Unit merge did not create an operation");
	const lockUnitIds = graphLockUnitIds(input.sourceUnitId, input.targetUnitId, input.graphPlan);
	for (const unitId of lockUnitIds)
		await tx.execute(
			sql`select pg_advisory_xact_lock(hashtextextended('unit-merge:' || ${unitId}::text, 0))`,
		);
	await tx.insert(unitMergeGraphLock).values(
		lockUnitIds.map((unitId) => ({
			unitId,
			operationId: operation.id,
			createdAt: input.now,
		})),
	);
	await tx.insert(unitMergeRedirect).values({
		sourceUnitId: input.sourceUnitId,
		targetUnitId: input.targetUnitId,
		requestId: input.requestId,
		createdAt: input.now,
	});
	const [tombstoned] = await tx
		.update(unit)
		.set({ deletedAt: input.now, postTargetingLocked: true, updatedAt: input.now })
		.where(and(eq(unit.id, input.sourceUnitId), sql`${unit.deletedAt} is null`))
		.returning({ id: unit.id });
	if (!tombstoned) throw new UnitNotFound();
	await tx
		.update(unitMergeRequest)
		.set({
			state: "accepted",
			acceptedAt: input.now,
			updatedAt: input.now,
		})
		.where(eq(unitMergeRequest.id, input.requestId));
	await auditMerge(tx, {
		action:
			input.mode === "privileged_direct" ? "unit.merge.direct.accept" : "unit.merge.review.accept",
		actorProfileId: input.actorProfileId,
		requestId: input.requestId,
		sourceUnitId: input.sourceUnitId,
		targetUnitId: input.targetUnitId,
		governanceDecisionId: input.governanceDecisionId,
		details: { operationId: operation.id, graphPlan: input.graphPlan },
	});
	return operation.id;
}

async function generateUuidv7(tx: DatabaseTransaction): Promise<string> {
	type GeneratedUuidRow = { readonly id: string };
	const generated = await tx.execute<GeneratedUuidRow>(sql`select uuidv7() as id`);
	const id = generated.rows[0]?.id;
	if (!id) throw new Error("UUIDv7 generation returned no id");
	return id;
}

function mapCreateConstraint(error: unknown): never {
	const constraint = databaseConstraintName(error);
	if (constraint === "unit_merge_request_proposer_idempotency_key")
		throw new UnitMergeIdempotencyConflict();
	if (
		constraint === "unit_merge_request_active_source_key" ||
		constraint === "unit_merge_request_override_of_key" ||
		constraint === "unit_merge_redirect_pkey" ||
		constraint === "unit_merge_graph_lock_pkey" ||
		constraint === "unit_merge_operation_source_key"
	)
		throw new UnitMergeRequestConflict();
	throw error;
}

export async function createReviewedUnitMerge(input: CreateMergeInput) {
	let requestId: string;
	try {
		requestId = await runVndbVoteTransaction(
			{ family: "unit_merge", authority: "global" },
			async (tx) => {
				await expirePendingMergeForSource(tx, input.sourceUnitId, new Date());
				const existing = await existingIdempotentRequest(tx, input, "reviewed");
				if (existing) return existing;
				const manifest = await buildUnitMergeManifest(tx, input);
				const now = new Date();
				const newRequestId = await generateUuidv7(tx);
				const decision = await createGovernanceDecision(tx, {
					action: "unit.merge.propose",
					actorProfileId: input.proposerProfileId,
					authority: { kind: "platform" },
					targetUnitId: manifest.sourceUnitId,
					subject: { kind: "unit_merge_request", id: newRequestId },
					basis: { kind: "rules", rules: input.rules },
				});
				const [created] = await tx
					.insert(unitMergeRequest)
					.values(
						requestInsertValues(
							manifest,
							input,
							newRequestId,
							decision.id,
							"reviewed",
							"pending_review",
							now,
						),
					)
					.returning({ id: unitMergeRequest.id });
				if (!created) throw new Error("Unit merge proposal insertion returned no row");
				await auditMerge(tx, {
					action: "unit.merge.propose",
					actorProfileId: input.proposerProfileId,
					requestId: created.id,
					sourceUnitId: manifest.sourceUnitId,
					targetUnitId: manifest.targetUnitId,
					governanceDecisionId: decision.id,
					details: {
						policyVersion: UnitMergePolicyV1.version,
						requiredApprovals: UnitMergePolicyV1.requiredApprovals,
						requestFingerprint: manifest.requestFingerprint,
					},
				});
				return created.id;
			},
		);
	} catch (error) {
		if (databaseConstraintName(error) === "unit_merge_request_proposer_idempotency_key") {
			const existing = await existingIdempotentRequest(database, input, "reviewed");
			if (existing) return getUnitMergeRequest(existing);
		}
		mapCreateConstraint(error);
	}
	return getUnitMergeRequest(requestId);
}

export async function createDirectUnitMerge(
	input: CreateMergeInput & { readonly overrideOfRequestId?: string },
) {
	let requestId: string;
	try {
		requestId = await runVndbVoteTransaction(
			{ family: "unit_merge", authority: "global" },
			async (tx) => {
				await expirePendingMergeForSource(tx, input.sourceUnitId, new Date());
				const existing = await existingIdempotentRequest(tx, input, "privileged_direct");
				if (existing) return existing;
				const manifest = await buildUnitMergeManifest(tx, input);
				if (input.overrideOfRequestId) {
					const [overridden] = await tx
						.select({
							state: unitMergeRequest.state,
							sourceUnitId: unitMergeRequest.sourceUnitId,
							targetUnitId: unitMergeRequest.targetUnitId,
						})
						.from(unitMergeRequest)
						.where(eq(unitMergeRequest.id, input.overrideOfRequestId))
						.limit(1)
						.for("update");
					if (
						!overridden ||
						overridden.state !== "rejected" ||
						overridden.sourceUnitId !== input.sourceUnitId ||
						overridden.targetUnitId !== input.targetUnitId
					)
						throw new UnitMergeRequestConflict();
				}
				const now = new Date();
				const newRequestId = await generateUuidv7(tx);
				const decision = await createGovernanceDecision(tx, {
					action: "unit.merge.direct",
					actorProfileId: input.proposerProfileId,
					authority: { kind: "platform" },
					targetUnitId: manifest.sourceUnitId,
					subject: { kind: "unit_merge_request", id: newRequestId },
					basis: { kind: "rules", rules: input.rules },
				});
				const [created] = await tx
					.insert(unitMergeRequest)
					.values({
						...requestInsertValues(
							manifest,
							input,
							newRequestId,
							decision.id,
							"privileged_direct",
							"accepted",
							now,
						),
						overrideOfRequestId: input.overrideOfRequestId,
					})
					.returning({ id: unitMergeRequest.id });
				if (!created) throw new Error("Direct Unit merge insertion returned no row");
				await acceptUnitMerge(tx, {
					requestId: created.id,
					sourceUnitId: manifest.sourceUnitId,
					targetUnitId: manifest.targetUnitId,
					graphPlan: manifest.graphPlan,
					actorProfileId: input.proposerProfileId,
					governanceDecisionId: decision.id,
					mode: "privileged_direct",
					now,
				});
				return created.id;
			},
		);
	} catch (error) {
		if (databaseConstraintName(error) === "unit_merge_request_proposer_idempotency_key") {
			const existing = await existingIdempotentRequest(database, input, "privileged_direct");
			if (existing) return getUnitMergeRequest(existing);
		}
		mapCreateConstraint(error);
	}
	return getUnitMergeRequest(requestId);
}

type ReviewTransactionResult =
	| { readonly outcome: "ok"; readonly requestId: string }
	| { readonly outcome: "expired" }
	| { readonly outcome: "stale" };

function isManifestStaleness(error: unknown): boolean {
	const tag = error && typeof error === "object" ? Reflect.get(error, "_tag") : undefined;
	return (
		tag === "UnitMergeManifestStale" ||
		tag === "UnitMergeRequestConflict" ||
		tag === "UnitNotFound" ||
		tag === "UnitMergeKindMismatch" ||
		tag === "UnitMergeKindIneligible"
	);
}

export async function reviewUnitMerge(input: {
	readonly requestId: string;
	readonly reviewerProfileId: string;
	readonly decision: UnitMergeReviewDecision;
	readonly requestFingerprint: string;
	readonly note?: string;
}) {
	let result: ReviewTransactionResult;
	try {
		result = await runVndbVoteTransaction(
			{ family: "unit_merge", authority: "global" },
			async (tx): Promise<ReviewTransactionResult> => {
				const [request] = await tx
					.select()
					.from(unitMergeRequest)
					.where(eq(unitMergeRequest.id, input.requestId))
					.limit(1)
					.for("update");
				if (!request) throw new UnitMergeNotFound();
				if (request.state !== "pending_review" || request.mode !== "reviewed")
					throw new UnitMergeRequestNotPending();
				const now = new Date();
				if (request.expiresAt.getTime() <= now.getTime()) {
					await tx
						.update(unitMergeRequest)
						.set({ state: "expired", updatedAt: now })
						.where(eq(unitMergeRequest.id, request.id));
					return { outcome: "expired" };
				}
				if (!request.decisionId) {
					await tx
						.update(unitMergeRequest)
						.set({ state: "superseded", supersededAt: now, updatedAt: now })
						.where(eq(unitMergeRequest.id, request.id));
					return { outcome: "stale" };
				}
				if (request.requestFingerprint !== input.requestFingerprint)
					throw new UnitMergeReviewFingerprintMismatch();
				if (request.selfReviewForbidden && request.proposerProfileId === input.reviewerProfileId)
					throw new UnitMergeReviewSelfForbidden();

				let manifest: UnitMergeManifestV1;
				try {
					manifest = await requireCurrentUnitMergeManifest(tx, {
						sourceUnitId: request.sourceUnitId,
						targetUnitId: request.targetUnitId,
						requestFingerprint: request.requestFingerprint,
					});
				} catch (error) {
					if (!isManifestStaleness(error)) throw error;
					await tx
						.update(unitMergeRequest)
						.set({ state: "superseded", supersededAt: now, updatedAt: now })
						.where(eq(unitMergeRequest.id, request.id));
					return { outcome: "stale" };
				}

				await tx.insert(unitMergeReview).values({
					requestId: request.id,
					reviewerProfileId: input.reviewerProfileId,
					decision: input.decision,
					note: input.note,
					requestFingerprint: input.requestFingerprint,
					createdAt: now,
				});
				await auditMerge(tx, {
					action: `unit.merge.review.${input.decision}`,
					actorProfileId: input.reviewerProfileId,
					requestId: request.id,
					sourceUnitId: request.sourceUnitId,
					targetUnitId: request.targetUnitId,
					governanceDecisionId: request.decisionId,
					details: { requestFingerprint: input.requestFingerprint, note: input.note },
				});
				if (input.decision === "reject" && request.vetoEnabled) {
					await tx
						.update(unitMergeRequest)
						.set({ state: "rejected", rejectedAt: now, updatedAt: now })
						.where(eq(unitMergeRequest.id, request.id));
					return { outcome: "ok", requestId: request.id };
				}
				const approvals = await tx
					.select({ reviewerProfileId: unitMergeReview.reviewerProfileId })
					.from(unitMergeReview)
					.where(
						and(eq(unitMergeReview.requestId, request.id), eq(unitMergeReview.decision, "approve")),
					)
					.limit(request.requiredApprovals);
				if (approvals.length >= request.requiredApprovals)
					await acceptUnitMerge(tx, {
						requestId: request.id,
						sourceUnitId: request.sourceUnitId,
						targetUnitId: request.targetUnitId,
						graphPlan: manifest.graphPlan,
						actorProfileId: input.reviewerProfileId,
						governanceDecisionId: request.decisionId,
						mode: "reviewed",
						now,
					});
				return { outcome: "ok", requestId: request.id };
			},
		);
	} catch (error) {
		const constraint = databaseConstraintName(error);
		if (constraint === "unit_merge_review_pkey") throw new UnitMergeReviewDuplicate();
		if (constraint === "unit_merge_review_self_forbidden") throw new UnitMergeReviewSelfForbidden();
		if (constraint === "unit_merge_review_fingerprint_stale")
			throw new UnitMergeReviewFingerprintMismatch();
		mapCreateConstraint(error);
	}
	if (result.outcome === "expired") throw new UnitMergeRequestExpired();
	if (result.outcome === "stale") throw new UnitMergeManifestStale();
	return getUnitMergeRequest(result.requestId);
}

export async function retryUnitMerge(input: {
	readonly requestId: string;
	readonly actorProfileId: string;
}) {
	await database.transaction(async (tx) => {
		const [operation] = await tx
			.select()
			.from(unitMergeOperation)
			.where(eq(unitMergeOperation.requestId, input.requestId))
			.limit(1)
			.for("update");
		if (!operation) throw new UnitMergeNotFound();
		if (operation.state !== "failed") throw new UnitMergeRetryUnavailable();
		const now = new Date();
		await tx
			.update(unitMergeOperation)
			.set({
				state: "pending",
				...(isEntityMeasurementMergePhase(operation.phase)
					? {
							phase: "entity_measurement_preflight" as const,
							measurementPreflightCursorEntityId: null,
						}
					: {}),
				availableAt: now,
				leaseToken: null,
				leaseExpiresAt: null,
				lastErrorCode: null,
				lastErrorMessage: null,
				attemptCount: 0,
				updatedAt: now,
			})
			.where(eq(unitMergeOperation.id, operation.id));
		await tx
			.update(unitMergeRequest)
			.set({ state: "accepted", failedAt: null, updatedAt: now })
			.where(eq(unitMergeRequest.id, operation.requestId));
		await auditMerge(tx, {
			action: "unit.merge.execution.retry",
			actorProfileId: input.actorProfileId,
			requestId: operation.requestId,
			sourceUnitId: operation.sourceUnitId,
			targetUnitId: operation.targetUnitId,
			details: { operationId: operation.id, attemptCount: operation.attemptCount },
		});
	});
	return getUnitMergeRequest(input.requestId);
}

/** Lazily expires a bounded page; the worker invokes this independently of execution. */
export async function expireUnitMergeRequests(now = new Date(), limit = 100): Promise<number> {
	const result = await database.execute<{ id: string }>(sql`
		with candidates as (
			select id
			from ${unitMergeRequest}
			where ${unitMergeRequest.state} = 'pending_review'
				and ${unitMergeRequest.expiresAt} <= ${now}
			order by ${unitMergeRequest.expiresAt}, ${unitMergeRequest.id}
			limit ${limit}
			for update skip locked
		)
		update ${unitMergeRequest} as request
		set state = 'expired', updated_at = ${now}
		from candidates
		where request.id = candidates.id
		returning request.id
	`);
	return result.rows.length;
}
