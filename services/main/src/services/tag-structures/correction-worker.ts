import {
	and,
	asc,
	eq,
	inArray,
	isNotNull,
	isNull,
	lte,
	ne,
	notInArray,
	or,
	sql,
} from "drizzle-orm";

import { recordAuditEvent } from "../audit";
import { database, type DatabaseTransaction } from "../database";
import { databaseConstraintName } from "../database/constraint";
import {
	unitStructureCorrection,
	unitStructureCorrectionPolicy,
	unitStructureCorrectionShard,
	UnitStructureCorrectionMaximumAttempts,
	UnitStructureCorrectionMaximumBatchSize,
	UnitStructureCorrectionMaximumStagingJobs,
	UnitStructureCorrectionShardPhaseValues,
	type UnitStructureCorrectionShardPhase,
} from "../database/schema";
import { recordUnitRevision } from "../units/history";
import type { RevisionContributionInput } from "../units/revision-contribution";

const TerminalStatuses = ["completed", "failed", "cancelled"] as const;
const RetryMaximumDelayMilliseconds = 10 * 60_000;

export type DispatchUnitStructureCorrectionOptions = {
	/** Independent jobs claimed by this call. The database policy may lower this bound. */
	readonly maxJobs?: number;
	/** Rows processed by the one shard step allowed for each claimed job. */
	readonly batchSize?: number;
	readonly now?: Date;
	readonly leaseOwner?: string;
};

type ClaimedCorrection = {
	readonly id: string;
	readonly leaseToken: string;
	readonly leaseOwner: string;
	readonly leaseSeconds: number;
	readonly batchSize: number;
};

type PendingShard = {
	readonly phase: UnitStructureCorrectionShardPhase;
	readonly shard: number;
};

type ProcessShardResult = {
	readonly processed: number | string;
	readonly done: boolean;
};

function boundedInteger(value: number, name: string, maximum: number): number {
	if (!Number.isSafeInteger(value) || value < 1 || value > maximum)
		throw new RangeError(`${name} must be an integer between 1 and ${maximum}`);
	return value;
}

function correctionWorkerLeaseOwner(explicit: string | undefined): string {
	const owner = explicit?.trim() || process.env.HOSTNAME?.trim() || "rezics-main-worker";
	return owner.slice(0, 200);
}

function retryDelayMilliseconds(attemptCount: number): number {
	return Math.min(2_000 * 2 ** Math.max(0, attemptCount - 1), RetryMaximumDelayMilliseconds);
}

async function claimCorrections(input: {
	readonly maxJobs: number;
	readonly requestedBatchSize?: number;
	readonly now: Date;
	readonly leaseOwner: string;
}): Promise<ClaimedCorrection[]> {
	return database.transaction(async (tx) => {
		const [policy] = await tx
			.select({
				maximumStagingJobs: unitStructureCorrectionPolicy.maximumStagingJobs,
				batchSize: unitStructureCorrectionPolicy.batchSize,
				leaseSeconds: unitStructureCorrectionPolicy.leaseSeconds,
			})
			.from(unitStructureCorrectionPolicy)
			.where(eq(unitStructureCorrectionPolicy.id, true))
			.limit(1)
			.for("update");
		if (!policy) throw new Error("Structure correction policy is not initialized");

		const [admitted] = await tx
			.select({ count: sql<number>`count(*)` })
			.from(unitStructureCorrection)
			.where(
				and(
					notInArray(unitStructureCorrection.status, [...TerminalStatuses]),
					or(
						ne(unitStructureCorrection.status, "pending"),
						isNotNull(unitStructureCorrection.leaseToken),
					),
				),
			);
		const availableStagingSlots = Math.max(
			0,
			policy.maximumStagingJobs - Number(admitted?.count ?? 0),
		);
		const leaseAvailable = or(
			isNull(unitStructureCorrection.leaseToken),
			lte(unitStructureCorrection.leaseExpiresAt, input.now),
		);
		const activeCandidates = await tx
			.select({ id: unitStructureCorrection.id })
			.from(unitStructureCorrection)
			.where(
				and(
					notInArray(unitStructureCorrection.status, [...TerminalStatuses]),
					ne(unitStructureCorrection.status, "pending"),
					lte(unitStructureCorrection.availableAt, input.now),
					leaseAvailable,
				),
			)
			.orderBy(asc(unitStructureCorrection.availableAt), asc(unitStructureCorrection.id))
			.limit(input.maxJobs)
			.for("update", { skipLocked: true });
		const pendingLimit = Math.min(input.maxJobs - activeCandidates.length, availableStagingSlots);
		const pendingCandidates = pendingLimit
			? await tx
					.select({ id: unitStructureCorrection.id })
					.from(unitStructureCorrection)
					.where(
						and(
							eq(unitStructureCorrection.status, "pending"),
							lte(unitStructureCorrection.availableAt, input.now),
							leaseAvailable,
						),
					)
					.orderBy(asc(unitStructureCorrection.availableAt), asc(unitStructureCorrection.id))
					.limit(pendingLimit)
					.for("update", { skipLocked: true })
			: [];
		const candidates = [...activeCandidates, ...pendingCandidates];
		if (!candidates.length) return [];
		const leaseExpiresAt = new Date(input.now.getTime() + policy.leaseSeconds * 1_000);
		const batchSize = Math.min(input.requestedBatchSize ?? policy.batchSize, policy.batchSize);
		const claimed = await tx
			.update(unitStructureCorrection)
			.set({
				leaseOwner: input.leaseOwner,
				leaseToken: sql`uuidv7()`,
				leaseExpiresAt,
				updatedAt: input.now,
			})
			.where(
				inArray(
					unitStructureCorrection.id,
					candidates.map(({ id }) => id),
				),
			)
			.returning({
				id: unitStructureCorrection.id,
				leaseToken: unitStructureCorrection.leaseToken,
			});
		return claimed.map((correction) => {
			if (!correction.leaseToken)
				throw new Error(`Claimed Structure correction ${correction.id} has no lease token`);
			return {
				id: correction.id,
				leaseToken: correction.leaseToken,
				leaseOwner: input.leaseOwner,
				leaseSeconds: policy.leaseSeconds,
				batchSize,
			};
		});
	});
}

async function setCorrectionAuthorization(
	tx: DatabaseTransaction,
	claimed: ClaimedCorrection,
): Promise<void> {
	await tx.execute(sql`select
		set_config('rezics.unit_structure_correction_id', ${claimed.id}, true),
		set_config('rezics.unit_structure_correction_lease_token', ${claimed.leaseToken}, true)
	`);
}

async function claimPendingShard(
	tx: DatabaseTransaction,
	claimed: ClaimedCorrection,
	now: Date,
): Promise<PendingShard | undefined> {
	const phaseOrder = sql.join(
		UnitStructureCorrectionShardPhaseValues.map((phase) => sql`${phase}`),
		sql`, `,
	);
	const result = await tx.execute<PendingShard>(sql`
		select phase, shard
		from unit_structure_correction_shard
		where job_id = ${claimed.id}::uuid
			and completed_at is null
			and (lease_token is null or lease_expires_at <= ${now})
		order by array_position(array[${phaseOrder}]::text[], phase), shard
		limit 1
		for update skip locked
	`);
	const shard = result.rows[0];
	if (!shard) return undefined;
	const [owned] = await tx
		.update(unitStructureCorrectionShard)
		.set({
			leaseOwner: claimed.leaseOwner,
			leaseToken: claimed.leaseToken,
			leaseExpiresAt: new Date(now.getTime() + claimed.leaseSeconds * 1_000),
			updatedAt: now,
		})
		.where(
			and(
				eq(unitStructureCorrectionShard.jobId, claimed.id),
				eq(unitStructureCorrectionShard.phase, shard.phase),
				eq(unitStructureCorrectionShard.shard, shard.shard),
			),
		)
		.returning({ shard: unitStructureCorrectionShard.shard });
	if (!owned) throw new Error(`Structure correction ${claimed.id} lost its shard lease`);
	return shard;
}

function correctionRevisionContribution(input: {
	readonly contributionKind: "unattributed" | "human" | "ai";
	readonly creditedEntityId: string | null;
	readonly contributionRole: "creator" | "editor" | "translator" | "researcher" | null;
}): RevisionContributionInput {
	if (input.contributionKind === "ai") {
		if (!input.creditedEntityId || !input.contributionRole)
			throw new Error("AI Structure correction is missing its contribution credit");
		return {
			primary: "ai",
			creditedEntityId: input.creditedEntityId,
			role: input.contributionRole,
		};
	}
	if (input.creditedEntityId || input.contributionRole)
		throw new Error(`${input.contributionKind} Structure correction has AI credit columns`);
	return { primary: input.contributionKind };
}

async function recordActivationEvidence(
	tx: DatabaseTransaction,
	claimed: ClaimedCorrection,
	now: Date,
): Promise<void> {
	const [correction] = await tx
		.select({
			status: unitStructureCorrection.status,
			structureId: unitStructureCorrection.structureId,
			sourceProjectionVersion: unitStructureCorrection.sourceProjectionVersion,
			targetProjectionVersion: unitStructureCorrection.targetProjectionVersion,
			sourceMemberUnitIds: unitStructureCorrection.sourceMemberUnitIds,
			targetMemberUnitIds: unitStructureCorrection.targetMemberUnitIds,
			requestedByProfileId: unitStructureCorrection.requestedByProfileId,
			reason: unitStructureCorrection.reason,
			contributionKind: unitStructureCorrection.contributionKind,
			creditedEntityId: unitStructureCorrection.creditedEntityId,
			contributionRole: unitStructureCorrection.contributionRole,
			activationRevisionId: unitStructureCorrection.activationRevisionId,
			activationAuditRecordedAt: unitStructureCorrection.activationAuditRecordedAt,
		})
		.from(unitStructureCorrection)
		.where(
			and(
				eq(unitStructureCorrection.id, claimed.id),
				eq(unitStructureCorrection.leaseToken, claimed.leaseToken),
			),
		)
		.limit(1);
	if (!correction || correction.status !== "active_overlay") return;
	if (correction.activationRevisionId && correction.activationAuditRecordedAt) return;
	if (correction.activationRevisionId || correction.activationAuditRecordedAt)
		throw new Error(`Structure correction ${claimed.id} has partial activation evidence`);
	const revision = await recordUnitRevision(tx, {
		unitId: correction.structureId,
		actorProfileId: correction.requestedByProfileId,
		contribution: correctionRevisionContribution(correction),
		event: "update",
		message: correction.reason,
	});
	await recordAuditEvent(tx, {
		category: "admin_activity",
		outcome: "succeeded",
		actor: { kind: "profile", profileId: correction.requestedByProfileId },
		authority: { kind: "unit", id: correction.structureId },
		action: "unit.structure.definition.correction.activate",
		target: { kind: "unit", id: correction.structureId },
		details: {
			correctionId: claimed.id,
			sourceProjectionVersion: correction.sourceProjectionVersion,
			targetProjectionVersion: correction.targetProjectionVersion,
			beforeMemberUnitIds: correction.sourceMemberUnitIds,
			afterMemberUnitIds: correction.targetMemberUnitIds,
			reason: correction.reason,
		},
	});
	const [recorded] = await tx
		.update(unitStructureCorrection)
		.set({
			activationRevisionId: revision.revisionId,
			activationAuditRecordedAt: now,
			updatedAt: now,
		})
		.where(
			and(
				eq(unitStructureCorrection.id, claimed.id),
				eq(unitStructureCorrection.leaseToken, claimed.leaseToken),
				isNull(unitStructureCorrection.activationRevisionId),
			),
		)
		.returning({ id: unitStructureCorrection.id });
	if (!recorded) throw new Error(`Structure correction ${claimed.id} lost activation ownership`);
}

async function processOneCorrectionStep(
	claimed: ClaimedCorrection,
	input: { readonly now: Date },
): Promise<void> {
	await database.transaction(async (tx) => {
		const [correction] = await tx
			.select({ status: unitStructureCorrection.status })
			.from(unitStructureCorrection)
			.where(
				and(
					eq(unitStructureCorrection.id, claimed.id),
					eq(unitStructureCorrection.leaseToken, claimed.leaseToken),
					notInArray(unitStructureCorrection.status, [...TerminalStatuses]),
				),
			)
			.limit(1)
			.for("update");
		if (!correction) return;
		await setCorrectionAuthorization(tx, claimed);
		const shard = await claimPendingShard(tx, claimed, input.now);
		if (shard) {
			const result = await tx.execute<ProcessShardResult>(sql`
				select processed, done
				from public.process_unit_structure_correction_shard(
					${claimed.id}::uuid,
					${claimed.leaseToken}::uuid,
					${shard.phase}::text,
					${shard.shard}::integer,
					${claimed.batchSize}::integer
				)
			`);
			const processed = result.rows[0];
			if (!processed)
				throw new Error(`Structure correction ${claimed.id} shard did not return a result`);
			const [releasedShard] = await tx
				.update(unitStructureCorrectionShard)
				.set({
					leaseOwner: null,
					leaseToken: null,
					leaseExpiresAt: null,
					processedCount: sql`${unitStructureCorrectionShard.processedCount} + ${Number(
						processed.processed,
					)}`,
					completedAt: processed.done ? input.now : null,
					updatedAt: input.now,
				})
				.where(
					and(
						eq(unitStructureCorrectionShard.jobId, claimed.id),
						eq(unitStructureCorrectionShard.phase, shard.phase),
						eq(unitStructureCorrectionShard.shard, shard.shard),
						eq(unitStructureCorrectionShard.leaseToken, claimed.leaseToken),
					),
				)
				.returning({ shard: unitStructureCorrectionShard.shard });
			if (!releasedShard)
				throw new Error(`Structure correction ${claimed.id} lost its shard lease`);
		} else if (correction.status === "pending") {
			await tx.execute(sql`
				select public.prepare_unit_structure_correction(
					${claimed.id}::uuid,
					${claimed.leaseToken}::uuid
				)
			`);
		} else {
			await tx.execute(sql`
				select public.advance_unit_structure_correction(
					${claimed.id}::uuid,
					${claimed.leaseToken}::uuid
				)
			`);
		}
		await recordActivationEvidence(tx, claimed, input.now);
		const [releasedJob] = await tx
			.update(unitStructureCorrection)
			.set({
				availableAt: input.now,
				leaseOwner: null,
				leaseToken: null,
				leaseExpiresAt: null,
				attemptCount: 0,
				lastErrorCode: null,
				lastErrorMessage: null,
				updatedAt: input.now,
			})
			.where(
				and(
					eq(unitStructureCorrection.id, claimed.id),
					eq(unitStructureCorrection.leaseToken, claimed.leaseToken),
				),
			)
			.returning({ id: unitStructureCorrection.id });
		if (!releasedJob) throw new Error(`Structure correction ${claimed.id} lost its job lease`);
	});
}

function failureDetails(error: unknown): { readonly code: string; readonly message: string } {
	const constraint = databaseConstraintName(error);
	return {
		code: constraint ? `database:${constraint}` : "UnitStructureCorrectionExecutionError",
		message: (error instanceof Error ? error.message : String(error)).slice(0, 2_000),
	};
}

export function isTerminalUnitStructureCorrectionFailure(error: unknown): boolean {
	const constraint = databaseConstraintName(error);
	return (
		constraint === "unit_structure_correction_preflight_conflict" ||
		constraint === "unit_structure_correction_stale_snapshot"
	);
}

async function markCorrectionFailure(
	claimed: ClaimedCorrection,
	error: unknown,
	now: Date,
): Promise<void> {
	const failure = failureDetails(error);
	await database.transaction(async (tx) => {
		const [correction] = await tx
			.select({
				status: unitStructureCorrection.status,
				writeRoute: unitStructureCorrection.writeRoute,
				attemptCount: unitStructureCorrection.attemptCount,
			})
			.from(unitStructureCorrection)
			.where(
				and(
					eq(unitStructureCorrection.id, claimed.id),
					eq(unitStructureCorrection.leaseToken, claimed.leaseToken),
				),
			)
			.limit(1)
			.for("update");
		if (!correction) return;
		const attemptedCount = correction.attemptCount + 1;
		const terminal =
			correction.writeRoute === "source" &&
			(isTerminalUnitStructureCorrectionFailure(error) ||
				attemptedCount >= UnitStructureCorrectionMaximumAttempts);
		if (terminal) {
			await setCorrectionAuthorization(tx, claimed);
			await tx.execute(sql`
				select public.fail_unit_structure_correction(
					${claimed.id}::uuid,
					${claimed.leaseToken}::uuid,
					${failure.code}::text,
					${failure.message}::text
				)
			`);
			const [failed] = await tx
				.select({ status: unitStructureCorrection.status })
				.from(unitStructureCorrection)
				.where(eq(unitStructureCorrection.id, claimed.id))
				.limit(1);
			if (failed?.status !== "failed")
				throw new Error(`Structure correction ${claimed.id} cleanup did not reach failed`);
			return;
		}
		const attemptCount = Math.min(attemptedCount, UnitStructureCorrectionMaximumAttempts);
		const [released] = await tx
			.update(unitStructureCorrection)
			.set({
				attemptCount,
				availableAt: new Date(now.getTime() + retryDelayMilliseconds(attemptCount)),
				leaseOwner: null,
				leaseToken: null,
				leaseExpiresAt: null,
				lastErrorCode: failure.code,
				lastErrorMessage: failure.message,
				updatedAt: now,
			})
			.where(
				and(
					eq(unitStructureCorrection.id, claimed.id),
					eq(unitStructureCorrection.leaseToken, claimed.leaseToken),
				),
			)
			.returning({ id: unitStructureCorrection.id });
		if (!released) throw new Error(`Structure correction ${claimed.id} lost failure ownership`);
	});
}

/**
 * Claims a bounded number of independent corrections. Each claimed job advances
 * exactly one state transition or one bounded shard batch, so `ready` and every
 * other activation boundary remain externally observable between dispatches.
 */
export async function dispatchUnitStructureCorrectionJobs(
	options: DispatchUnitStructureCorrectionOptions = {},
): Promise<number> {
	const maxJobs = boundedInteger(
		options.maxJobs ?? UnitStructureCorrectionMaximumStagingJobs,
		"maxJobs",
		UnitStructureCorrectionMaximumStagingJobs,
	);
	const requestedBatchSize =
		options.batchSize === undefined
			? undefined
			: boundedInteger(options.batchSize, "batchSize", UnitStructureCorrectionMaximumBatchSize);
	const now = options.now ?? new Date();
	if (Number.isNaN(now.getTime())) throw new RangeError("now must be a valid Date");
	const leaseOwner = correctionWorkerLeaseOwner(options.leaseOwner);
	const claimed = await claimCorrections({ maxJobs, requestedBatchSize, now, leaseOwner });
	await Promise.all(
		claimed.map(async (correction) => {
			try {
				await processOneCorrectionStep(correction, { now });
			} catch (error) {
				await markCorrectionFailure(correction, error, now);
			}
		}),
	);
	return claimed.length;
}
