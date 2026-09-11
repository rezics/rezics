import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq, inArray, lt, lte, sql } from "drizzle-orm";
import type { z } from "zod";
import type { Authorization } from "../../authorization";
import { database, type DatabaseTransaction } from "../../database";
import {
	unitMergeRequest,
	unitMergeReview,
	unitMergeOperation,
	unitMergeGraphLock,
	unitMergeReconciliationItem,
	authEntity,
	users,
	governanceDecisionRule,
	catalogSourceMappingClaim,
	catalogSourceBindingRevision,
} from "../../database/schema";
import {
	ParticipationAuthoritySchema,
	ParticipationDenied,
	runWithParticipationAuthority,
	type ParticipationAuthority,
} from "../../participation/policy";
import { createGovernanceDecision } from "../../governance/decision-service";
import { recordAuditEvent } from "../../audit";
import {
	UnitMergeConfirmationInvalid,
	UnitMergeIdempotencyConflict,
	UnitMergeManifestStale,
	UnitMergeNotFound,
	UnitMergeRequestNotPending,
	UnitMergeRequestExpired,
	UnitMergeReviewSelfForbidden,
	UnitMergeReviewDuplicate,
	UnitMergeReviewFingerprintMismatch,
	UnitMergeRetryUnavailable,
} from "../../api/governance/errors";
import { buildUnitMergeManifest, assertMergeManifestFingerprint } from "./manifest";
import {
	MergeCreateSchema,
	MergePreflightSchema,
	MergeReviewSchema,
	MergeListSchema,
	MergeItemListSchema,
	MergeRequestSchema,
	MergeItemSchema,
	MergeManifestSchema,
	MergePlanSchema,
} from "./contracts";
import { unitMergeRequestExpiry } from "./policy";
import { withCatalogViewerPolicy } from "../../catalog/read-policy";

type RequestRow = typeof unitMergeRequest.$inferSelect;
/** Retain the current human Self binding and reject a stale admitted revision. @internal */
export async function humanMergeAuthority(
	tx: DatabaseTransaction,
	authorization: Authorization<string>,
): Promise<ParticipationAuthority & { principal: { kind: "auth"; authUserId: string } }> {
	const actor = authorization.authUserId;
	if (!actor) throw new ParticipationDenied();
	const [self] = await tx
		.select({ id: authEntity.entityId, revision: authEntity.revision })
		.from(authEntity)
		.innerJoin(users, eq(users.id, authEntity.authUserId))
		.where(
			and(
				eq(authEntity.authUserId, actor),
				eq(authEntity.entityId, authorization.profileId),
				eq(authEntity.state, "active"),
				eq(users.principalKind, "human"),
				sql`${users.erasedAt} is null`,
			),
		)
		.limit(1)
		.for("share");
	if (!self) throw new ParticipationDenied("Merge requires a current human account");
	const admitted = ParticipationAuthoritySchema.parse(
		authorization.participationAuthority ?? {
			principal: { kind: "auth", authUserId: actor },
			actingEntityId: self.id,
			authorizationRevision: self.revision,
		},
	);
	if (admitted.principal.kind !== "auth" || admitted.principal.authUserId !== actor)
		throw new ParticipationDenied("Merge review cannot use a service principal");
	if (admitted.authorizationRevision !== self.revision)
		throw new ParticipationDenied("Merge account self identity changed");
	return { ...admitted, principal: admitted.principal };
}
function manifestFromRow(row: RequestRow) {
	return MergeManifestSchema.parse({
		owner: row.owner,
		shape: row.shape,
		sourceUnit: { id: row.sourceUnitId, title: row.sourceTitle },
		targetUnit: { id: row.targetUnitId, title: row.targetTitle },
		sourceRevision: row.sourceRevision,
		targetRevision: row.targetRevision,
		sourceUpdatedAt: row.sourceUpdatedAt.toISOString(),
		targetUpdatedAt: row.targetUpdatedAt.toISOString(),
		status: row.statusAtRequest,
		visibility: row.visibilityAtRequest,
		plan: MergePlanSchema.parse(row.plan),
		fingerprint: row.requestFingerprint,
	});
}
async function views(tx: DatabaseTransaction, rows: readonly RequestRow[]) {
	if (!rows.length) return [];
	const ids = rows.map((row) => row.id);
	const reviews = await tx
		.select()
		.from(unitMergeReview)
		.where(inArray(unitMergeReview.requestId, ids))
		.limit(ids.length * 2);
	const operations = await tx
		.select()
		.from(unitMergeOperation)
		.where(inArray(unitMergeOperation.requestId, ids))
		.limit(ids.length);
	const rules = await tx
		.select()
		.from(governanceDecisionRule)
		.where(inArray(governanceDecisionRule.decisionId, rows.map((row) => row.decisionId)))
		.limit(rows.length * 32);
	return rows.map((row) => {
		const votes = reviews.filter((vote) => vote.requestId === row.id),
			op = operations.find((op) => op.requestId === row.id);
		return MergeRequestSchema.parse({
			id: row.id,
			state: row.state,
			manifest: manifestFromRow(row),
			proposer: { entityId: row.proposerProfileId },
			note: row.note,
			requiredApprovals: 2,
			rules: rules
				.filter((rule) => rule.decisionId === row.decisionId)
				.map((rule) => ({
					sourceRealmId: rule.ruleSourceRealmId,
					revisionId: rule.ruleRevisionId,
					ruleId: rule.ruleId,
				})),
			approvals: votes.filter((v) => v.decision === "approve").length,
			rejections: votes.filter((v) => v.decision === "reject").length,
			reviews: votes.map((v) => ({
				entityId: v.reviewerProfileId,
				decision: v.decision,
				note: v.note,
				createdAt: v.createdAt.toISOString(),
			})),
			operation: op
				? {
						id: op.id,
						state: op.state,
						phase: op.phase,
						processedRows: op.processedRows,
						totalItems: op.totalItems,
						resolvedItems: op.resolvedItems,
						attemptCount: op.attemptCount,
						availableAt: op.availableAt.toISOString(),
						lastErrorCode: op.lastErrorCode,
						lastErrorMessage: op.lastErrorMessage,
						startedAt: op.startedAt?.toISOString() ?? null,
						completedAt: op.completedAt?.toISOString() ?? null,
					}
				: null,
			expiresAt: row.expiresAt.toISOString(),
			acceptedAt: row.acceptedAt?.toISOString() ?? null,
			canonicalizedAt: row.canonicalizedAt?.toISOString() ?? null,
			completedAt: row.completedAt?.toISOString() ?? null,
			createdAt: row.createdAt.toISOString(),
		});
	});
}
async function requireRequest(tx: DatabaseTransaction, id: string, lock = false) {
	const query = tx.select().from(unitMergeRequest).where(eq(unitMergeRequest.id, id)).limit(1);
	const [row] = await (lock ? query.for("update") : query);
	if (!row) throw new UnitMergeNotFound();
	return row;
}
async function oneView(tx: DatabaseTransaction, row: RequestRow) {
	const [view] = await views(tx, [row]);
	if (!view) throw new UnitMergeNotFound();
	return view;
}
export async function preflightUnitMerge(
	authorization: Authorization<string>,
	input: z.input<typeof MergePreflightSchema>,
) {
	const value = MergePreflightSchema.parse(input);
	return database.transaction(async (tx) => {
		await authorization.platform.ensureCapability("unit.merge.propose", tx);
		const authority = await humanMergeAuthority(tx, authorization);
		return runWithParticipationAuthority(authority, () => withCatalogViewerPolicy(tx, authority.principal.authUserId,
			() => buildUnitMergeManifest(tx, authorization, value)));
	});
}
export async function createReviewedUnitMerge(
	authorization: Authorization<string>,
	input: z.input<typeof MergeCreateSchema>,
) {
	const value = MergeCreateSchema.parse(input);
	if (
		value.sourceUnitId !== value.confirmationSourceUnitId ||
		value.targetUnitId !== value.confirmationTargetUnitId
	)
		throw new UnitMergeConfirmationInvalid();
	return database.transaction(async (tx) => {
		await authorization.platform.ensureCapability("unit.merge.propose", tx);
		const authority = await humanMergeAuthority(tx, authorization);
		const [existing] = await tx
			.select()
			.from(unitMergeRequest)
			.where(
				and(
					eq(unitMergeRequest.proposerAuthUserId, authority.principal.authUserId),
					eq(unitMergeRequest.idempotencyKey, value.idempotencyKey),
				),
			)
			.limit(1);
		if (existing) {
			if (existing.requestFingerprint !== value.requestFingerprint)
				throw new UnitMergeIdempotencyConflict();
			return oneView(tx, existing);
		}
		const manifest = await runWithParticipationAuthority(authority, () => withCatalogViewerPolicy(tx, authority.principal.authUserId,
			() => buildUnitMergeManifest(tx, authorization, value)));
		assertMergeManifestFingerprint(manifest, value.requestFingerprint);
		if (
			manifest.sourceRevision !== value.expectedSourceRevision ||
			manifest.targetRevision !== value.expectedTargetRevision
		)
			throw new UnitMergeManifestStale();
		const id = randomUUID(),
			decision = await createGovernanceDecision(tx, {
				action: "unit.merge.propose",
				actorProfileId: authorization.profileId,
				authority: { kind: "platform" },
				targetUnitId: value.sourceUnitId,
				subject: { kind: "unit_merge_request", id },
				basis: { kind: "rules", rules: value.rules },
			});
		const [row] = await tx
			.insert(unitMergeRequest)
			.values({
				id,
				sourceUnitId: value.sourceUnitId,
				targetUnitId: value.targetUnitId,
				owner: manifest.owner,
				shape: manifest.shape,
				sourceRevision: manifest.sourceRevision,
				targetRevision: manifest.targetRevision,
				sourceUpdatedAt: new Date(manifest.sourceUpdatedAt),
				targetUpdatedAt: new Date(manifest.targetUpdatedAt),
				statusAtRequest: manifest.status,
				visibilityAtRequest: manifest.visibility,
				sourceTitle: manifest.sourceUnit.title,
				targetTitle: manifest.targetUnit.title,
				proposerProfileId: authorization.profileId,
				proposerAuthUserId: authority.principal.authUserId,
				proposerAuthority: authority,
				idempotencyKey: value.idempotencyKey,
				decisionId: decision.id,
				requestFingerprint: manifest.fingerprint,
				plan: manifest.plan,
				note: value.note,
				expiresAt: unitMergeRequestExpiry(new Date()),
			})
			.returning();
		if (!row) throw new Error("Merge request insertion did not return a row");
		await recordAuditEvent(tx, {
			category: "admin_activity",
			outcome: "succeeded",
			actor: { kind: "auth", authUserId: authority.principal.authUserId },
			authority: { kind: "platform" },
			action: "unit.merge.propose",
			governanceDecisionId: decision.id,
			target: { kind: "unit_merge_request", id },
			details: {
				owner: row.owner,
				shape: row.shape,
				sourceUnitId: row.sourceUnitId,
				targetUnitId: row.targetUnitId,
				plan: row.plan,
			},
		});
		return oneView(tx, row);
	});
}
export async function getUnitMergeRequest(authorization: Authorization<string>, id: string) {
	return database.transaction(
		async (tx) => {
			await authorization.platform.ensureCapability("unit.governance.read", tx);
			return oneView(tx, await requireRequest(tx, id));
		},
		{ isolationLevel: "repeatable read" },
	);
}
export async function listUnitMergeRequests(
	authorization: Authorization<string>,
	input: z.input<typeof MergeListSchema>,
) {
	const value = MergeListSchema.parse(input);
	return database.transaction(
		async (tx) => {
			await authorization.platform.ensureCapability("unit.governance.read", tx);
			const rows = await tx
				.select()
				.from(unitMergeRequest)
				.where(
					and(
						value.state ? eq(unitMergeRequest.state, value.state) : undefined,
						value.cursor ? lt(unitMergeRequest.id, value.cursor) : undefined,
					),
				)
				.orderBy(desc(unitMergeRequest.id))
				.limit(value.limit + 1);
			const page = rows.slice(0, value.limit);
			return {
				items: await views(tx, page),
				nextCursor: rows.length > value.limit ? (page.at(-1)?.id ?? null) : null,
			};
		},
		{ isolationLevel: "repeatable read" },
	);
}
export async function reviewUnitMerge(
	authorization: Authorization<string>,
	requestId: string,
	input: z.input<typeof MergeReviewSchema>,
) {
	const value = MergeReviewSchema.parse(input);
	return database.transaction(async (tx) => {
		await authorization.platform.ensureCapability("unit.merge.review", tx);
		const authority = await humanMergeAuthority(tx, authorization),
			row = await requireRequest(tx, requestId, true);
		if (row.state !== "pending_review") throw new UnitMergeRequestNotPending();
		if (row.expiresAt <= new Date()) throw new UnitMergeRequestExpired();
		if (row.proposerAuthUserId === authority.principal.authUserId)
			throw new UnitMergeReviewSelfForbidden();
		if (row.requestFingerprint !== value.requestFingerprint)
			throw new UnitMergeReviewFingerprintMismatch();
		const [existing] = await tx
			.select({ id: unitMergeReview.requestId })
			.from(unitMergeReview)
			.where(
				and(
					eq(unitMergeReview.requestId, requestId),
					eq(unitMergeReview.reviewerAuthUserId, authority.principal.authUserId),
				),
			)
			.limit(1);
		if (existing) throw new UnitMergeReviewDuplicate();
		const current = await runWithParticipationAuthority(authority, () =>
			withCatalogViewerPolicy(tx, authority.principal.authUserId, () =>
				buildUnitMergeManifest(tx, authorization, {
					sourceUnitId: row.sourceUnitId,
					targetUnitId: row.targetUnitId,
					plan: MergePlanSchema.parse(row.plan),
				}, "read", value.readGrants),
			),
		);
		assertMergeManifestFingerprint(current, row.requestFingerprint);
		await tx.insert(unitMergeReview).values({
			requestId,
			reviewerAuthUserId: authority.principal.authUserId,
			reviewerProfileId: authorization.profileId,
			decision: value.decision,
			requestFingerprint: value.requestFingerprint,
			note: value.note,
		});
		if (value.decision === "reject")
			await tx
				.update(unitMergeRequest)
				.set({ state: "rejected" })
				.where(eq(unitMergeRequest.id, requestId));
		else {
			const votes = await tx
				.select({ decision: unitMergeReview.decision })
				.from(unitMergeReview)
				.where(eq(unitMergeReview.requestId, requestId))
				.limit(2);
			if (votes.length === 2 && votes.every((vote) => vote.decision === "approve")) {
				await tx
					.update(unitMergeRequest)
					.set({ state: "accepted", acceptedAt: new Date() })
					.where(eq(unitMergeRequest.id, requestId));
				const [operation] = await tx
					.insert(unitMergeOperation)
					.values({
						requestId,
						sourceUnitId: row.sourceUnitId,
						targetUnitId: row.targetUnitId,
						owner: row.owner,
						shard: createHash("sha256").update(requestId).digest().readUInt16BE(0) % 64,
						executorAuthUserId: row.proposerAuthUserId,
						executorProfileId: row.proposerProfileId,
						executorAuthority: ParticipationAuthoritySchema.parse(row.proposerAuthority),
					})
					.returning({ id: unitMergeOperation.id });
				if (!operation) throw new Error("Merge operation insertion did not return a row");
				await tx
					.insert(unitMergeGraphLock)
					.values(
						[row.sourceUnitId, row.targetUnitId]
							.sort()
							.map((unitId) => ({ unitId, operationId: operation.id })),
					);
			}
		}
		await recordAuditEvent(tx, {
			category: "admin_activity",
			outcome: "succeeded",
			actor: { kind: "auth", authUserId: authority.principal.authUserId },
			authority: { kind: "platform" },
			action: `unit.merge.review.${value.decision}`,
			target: { kind: "unit_merge_request", id: requestId },
			details: { requestFingerprint: row.requestFingerprint, readGrants: value.readGrants ?? null },
		});
		return oneView(tx, await requireRequest(tx, requestId));
	});
}
export async function retryUnitMerge(authorization: Authorization<string>, requestId: string) {
	return database.transaction(async (tx) => {
		await authorization.platform.ensureCapability("unit.merge", tx);
		const authority = await humanMergeAuthority(tx, authorization),
			row = await requireRequest(tx, requestId, true);
		const [op] = await tx
			.select()
			.from(unitMergeOperation)
			.where(eq(unitMergeOperation.requestId, requestId))
			.limit(1)
			.for("update");
		if (!op || !["failed", "action_required", "retry_wait"].includes(op.state))
			throw new UnitMergeRetryUnavailable();
		await tx
			.update(unitMergeOperation)
			.set({
				state: "pending",
				availableAt: new Date(),
				leaseToken: null,
				leaseExpiresAt: null,
				executorAuthUserId: authority.principal.authUserId,
				executorProfileId: authorization.profileId,
				executorAuthority: authority,
				lastErrorCode: null,
				lastErrorMessage: null,
			})
			.where(eq(unitMergeOperation.id, op.id));
		await tx
			.update(unitMergeRequest)
			.set({ state: "executing" })
			.where(eq(unitMergeRequest.id, row.id));
		await recordAuditEvent(tx, {
			category: "admin_activity",
			outcome: "succeeded",
			actor: { kind: "auth", authUserId: authority.principal.authUserId },
			authority: { kind: "platform" },
			action: "unit.merge.retry",
			target: { kind: "unit_merge_request", id: requestId },
			details: { phase: op.phase },
		});
		return oneView(tx, await requireRequest(tx, requestId));
	});
}
export function presentMergeItem(row: typeof unitMergeReconciliationItem.$inferSelect,
	currentBinding: z.infer<typeof MergeItemSchema>["currentBinding"] = null) {
	return MergeItemSchema.parse({
		id: row.id,
		kind: row.kind,
		state: row.state,
		sourceKey: row.sourceKey,
		decision: row.decision,
		sourceReference: { owner: row.owner, id: row.sourceUnitId },
		targetReference: { owner: row.owner, id: row.targetUnitId },
		sourceNameId: row.sourceNameId,
		sourceNameRevision: row.sourceNameRevision,
		targetNameId: row.targetNameId,
		targetNameRevision: row.targetNameRevision,
		sourceIdentifierId: row.sourceIdentifierId,
		sourceIdentifierRevision: row.sourceIdentifierRevision,
		targetIdentifierId: row.targetIdentifierId,
		targetIdentifierRevision: row.targetIdentifierRevision,
		sourceSemanticId: row.sourceSemanticId,
		sourceSemanticVersion: row.sourceSemanticVersion,
		sourceRecordId: row.sourceRecordId,
		mappingKey: row.mappingKey,
		sourceBindingRevision: row.sourceBindingRevision,
		targetBindingRevision: row.targetBindingRevision,
		currentBinding,
		errorCode: row.errorCode,
		resolvedAt: row.resolvedAt?.toISOString() ?? null,
	});
}
export async function listMergeReconciliationItems(
	authorization: Authorization<string>,
	requestId: string,
	input: z.input<typeof MergeItemListSchema>,
) {
	const value = MergeItemListSchema.parse(input);
	return database.transaction(async (tx) => {
		await authorization.platform.ensureCapability("unit.governance.read", tx);
		await requireRequest(tx, requestId);
		const t = unitMergeReconciliationItem, claim = catalogSourceMappingClaim, binding = catalogSourceBindingRevision,
			rows = await tx
				.select({ item: t, currentBinding: {
					revision: binding.revision, state: binding.state, owner: binding.owner,
					id: sql<string>`coalesce(${binding.publishingId},${binding.musicId},${binding.programId},${binding.softwareId},${binding.entityId},${binding.groupingId},${binding.referenceId},${binding.distributionId})`,
				} })
				.from(t)
				.leftJoin(claim, and(eq(claim.sourceRecordId, t.sourceRecordId), eq(claim.mappingKey, t.mappingKey)))
				.leftJoin(binding, and(eq(binding.sourceRecordId, claim.sourceRecordId), eq(binding.mappingKey, claim.mappingKey), eq(binding.revision, claim.bindingRevision)))
				.where(
					and(
						eq(t.requestId, requestId),
						value.state ? eq(t.state, value.state) : undefined,
						value.cursor ? lt(t.id, value.cursor) : undefined,
					),
				)
				.orderBy(desc(t.id))
				.limit(value.limit + 1);
		const page = rows.slice(0, value.limit);
		return {
			items: page.map(({ item, currentBinding }) => presentMergeItem(item, currentBinding ? {
				revision: currentBinding.revision, state: currentBinding.state,
				reference: { owner: currentBinding.owner, id: currentBinding.id },
			} : null)),
			nextCursor: rows.length > value.limit ? (page.at(-1)?.item.id ?? null) : null,
		};
	});
}
export async function expireUnitMergeRequests(now = new Date(), limit = 100) {
	return database.transaction(async (tx) => {
		const rows = await tx
			.select({ id: unitMergeRequest.id })
			.from(unitMergeRequest)
			.where(
				and(eq(unitMergeRequest.state, "pending_review"), lte(unitMergeRequest.expiresAt, now)),
			)
			.orderBy(unitMergeRequest.expiresAt, unitMergeRequest.id)
			.limit(Math.min(100, limit))
			.for("update", { skipLocked: true });
		if (rows.length)
			await tx
				.update(unitMergeRequest)
				.set({ state: "expired" })
				.where(
					inArray(
						unitMergeRequest.id,
						rows.map((row) => row.id),
					),
				);
		return rows.length;
	});
}
