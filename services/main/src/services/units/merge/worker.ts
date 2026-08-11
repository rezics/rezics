import { and, asc, eq, inArray, lte, or, sql } from "drizzle-orm";

import { recordAuditEvent } from "../../audit";
import { database, type DatabaseTransaction } from "../../database";
import {
	unit,
	unitMergeGraphLock,
	unitMergeOperation,
	unitMergeRequest,
	type UnitMergeGraphPlanV1,
	type UnitMergeOperationPhase,
} from "../../database/schema";
import { processUnitMergePhase } from "./phase-handlers";
import { nextUnitMergePhase, UnitMergePolicyV1, unitMergeRetryDelayMilliseconds } from "./policy";

const MaximumStepsPerDispatch = 32;

type ClaimedUnitMergeOperation = {
	readonly id: string;
	readonly requestId: string;
	readonly sourceUnitId: string;
	readonly targetUnitId: string;
	readonly phase: UnitMergeOperationPhase;
	readonly attemptCount: number;
	readonly leaseToken: string;
	readonly graphPlan: UnitMergeGraphPlanV1;
};

export async function claimUnitMergeOperations(
	now: Date,
	limit = UnitMergePolicyV1.workerClaimBatchSize,
): Promise<ClaimedUnitMergeOperation[]> {
	return database.transaction(async (tx) => {
		const candidates = await tx
			.select({ id: unitMergeOperation.id })
			.from(unitMergeOperation)
			.where(
				or(
					and(
						inArray(unitMergeOperation.state, ["pending", "retry_wait"]),
						lte(unitMergeOperation.availableAt, now),
					),
					and(
						eq(unitMergeOperation.state, "processing"),
						lte(unitMergeOperation.leaseExpiresAt, now),
					),
				),
			)
			.orderBy(asc(unitMergeOperation.availableAt), asc(unitMergeOperation.createdAt))
			.limit(limit)
			.for("update", { skipLocked: true });
		const ids = candidates.map(({ id }) => id);
		if (!ids.length) return [];
		const leaseExpiresAt = new Date(now.getTime() + UnitMergePolicyV1.workerLeaseDurationMs);
		const claimed = await tx
			.update(unitMergeOperation)
			.set({
				state: "processing",
				leaseToken: sql`uuidv7()`,
				leaseExpiresAt,
				startedAt: sql`coalesce(${unitMergeOperation.startedAt}, ${now})`,
				updatedAt: now,
			})
			.where(inArray(unitMergeOperation.id, ids))
			.returning({
				id: unitMergeOperation.id,
				requestId: unitMergeOperation.requestId,
				sourceUnitId: unitMergeOperation.sourceUnitId,
				targetUnitId: unitMergeOperation.targetUnitId,
				phase: unitMergeOperation.phase,
				attemptCount: unitMergeOperation.attemptCount,
				leaseToken: unitMergeOperation.leaseToken,
			});
		await tx
			.update(unitMergeRequest)
			.set({ state: "executing", updatedAt: now })
			.where(
				inArray(
					unitMergeRequest.id,
					claimed.map(({ requestId }) => requestId),
				),
			);
		const requests = await tx
			.select({ id: unitMergeRequest.id, graphPlan: unitMergeRequest.graphPlan })
			.from(unitMergeRequest)
			.where(
				inArray(
					unitMergeRequest.id,
					claimed.map(({ requestId }) => requestId),
				),
			);
		const graphPlanByRequest = new Map(requests.map((request) => [request.id, request.graphPlan]));
		return claimed.map((operation) => {
			const graphPlan = graphPlanByRequest.get(operation.requestId);
			if (!operation.leaseToken || !graphPlan)
				throw new Error(`Claimed Unit merge ${operation.id} has an incomplete manifest`);
			return { ...operation, leaseToken: operation.leaseToken, graphPlan };
		});
	});
}

type StepResult =
	| { readonly outcome: "continue"; readonly phase: UnitMergeOperationPhase }
	| { readonly outcome: "completed" }
	| { readonly outcome: "lease_lost" };

async function recordSystemMergeAudit(
	tx: DatabaseTransaction,
	input: {
		readonly action: string;
		readonly outcome?: "succeeded" | "failed";
		readonly requestId: string;
		readonly sourceUnitId: string;
		readonly targetUnitId: string;
		readonly details?: Record<string, unknown>;
	},
): Promise<void> {
	await recordAuditEvent(tx, {
		category: "system_event",
		outcome: input.outcome ?? "succeeded",
		actor: { kind: "system" },
		authority: { kind: "platform" },
		action: input.action,
		target: { kind: "unit_merge_request", id: input.requestId },
		details: {
			sourceUnitId: input.sourceUnitId,
			targetUnitId: input.targetUnitId,
			...input.details,
		},
	});
}

async function processClaimedStep(
	claimed: ClaimedUnitMergeOperation,
	phase: UnitMergeOperationPhase,
): Promise<StepResult> {
	return database.transaction(async (tx): Promise<StepResult> => {
		const [operation] = await tx
			.select({
				id: unitMergeOperation.id,
				state: unitMergeOperation.state,
				phase: unitMergeOperation.phase,
				leaseToken: unitMergeOperation.leaseToken,
			})
			.from(unitMergeOperation)
			.where(eq(unitMergeOperation.id, claimed.id))
			.limit(1)
			.for("update");
		if (
			!operation ||
			operation.state !== "processing" ||
			operation.leaseToken !== claimed.leaseToken ||
			operation.phase !== phase
		)
			return { outcome: "lease_lost" };
		await tx.execute(sql`select set_config('rezics.unit_merge_operation_id', ${claimed.id}, true)`);

		const result = await processUnitMergePhase(tx, phase, {
			operationId: claimed.id,
			sourceUnitId: claimed.sourceUnitId,
			targetUnitId: claimed.targetUnitId,
			graphPlan: claimed.graphPlan,
			batchSize: UnitMergePolicyV1.workerBatchSize,
		});
		const now = new Date();
		if (phase === "finalize" && result.done) {
			await tx.delete(unitMergeGraphLock).where(eq(unitMergeGraphLock.operationId, claimed.id));
			await tx.update(unit).set({ updatedAt: now }).where(eq(unit.id, claimed.targetUnitId));
			await tx.execute(
				sql`select public.refresh_unit_search_document(${claimed.targetUnitId}::uuid)`,
			);
			await tx
				.update(unitMergeOperation)
				.set({
					state: "completed",
					processedRows: sql`${unitMergeOperation.processedRows} + ${result.processedRows}`,
					attemptCount: 0,
					leaseToken: null,
					leaseExpiresAt: null,
					lastErrorCode: null,
					lastErrorMessage: null,
					completedAt: now,
					updatedAt: now,
				})
				.where(eq(unitMergeOperation.id, claimed.id));
			await tx
				.update(unitMergeRequest)
				.set({ state: "completed", completedAt: now, failedAt: null, updatedAt: now })
				.where(eq(unitMergeRequest.id, claimed.requestId));
			await recordSystemMergeAudit(tx, {
				action: "unit.merge.execution.complete",
				requestId: claimed.requestId,
				sourceUnitId: claimed.sourceUnitId,
				targetUnitId: claimed.targetUnitId,
				details: { operationId: claimed.id },
			});
			return { outcome: "completed" };
		}

		const nextPhase = result.done ? nextUnitMergePhase(phase) : phase;
		if (!nextPhase) throw new Error(`Unit merge phase ${phase} has no successor`);
		await tx
			.update(unitMergeOperation)
			.set({
				phase: nextPhase,
				processedRows: sql`${unitMergeOperation.processedRows} + ${result.processedRows}`,
				attemptCount: 0,
				lastErrorCode: null,
				lastErrorMessage: null,
				leaseExpiresAt: new Date(now.getTime() + UnitMergePolicyV1.workerLeaseDurationMs),
				updatedAt: now,
			})
			.where(
				and(
					eq(unitMergeOperation.id, claimed.id),
					eq(unitMergeOperation.leaseToken, claimed.leaseToken),
				),
			);
		return { outcome: "continue", phase: nextPhase };
	});
}

function failureDetails(error: unknown): { code: string; message: string } {
	const tag = error && typeof error === "object" ? Reflect.get(error, "_tag") : undefined;
	const constraint =
		error && typeof error === "object" ? Reflect.get(error, "constraint") : undefined;
	const rawMessage = error instanceof Error ? error.message : String(error);
	return {
		code:
			typeof tag === "string"
				? tag
				: typeof constraint === "string"
					? `database:${constraint}`
					: "UnitMergeExecutionError",
		message: (rawMessage.trim() || "Unknown Unit merge execution failure").slice(0, 2_000),
	};
}

async function markClaimedFailure(
	claimed: ClaimedUnitMergeOperation,
	error: unknown,
	now = new Date(),
): Promise<void> {
	const failure = failureDetails(error);
	await database.transaction(async (tx) => {
		const [operation] = await tx
			.select({
				state: unitMergeOperation.state,
				leaseToken: unitMergeOperation.leaseToken,
				attemptCount: unitMergeOperation.attemptCount,
			})
			.from(unitMergeOperation)
			.where(eq(unitMergeOperation.id, claimed.id))
			.limit(1)
			.for("update");
		if (
			!operation ||
			operation.state !== "processing" ||
			operation.leaseToken !== claimed.leaseToken
		)
			return;
		const attemptCount = operation.attemptCount + 1;
		const terminal = attemptCount >= UnitMergePolicyV1.workerMaximumAutomaticAttempts;
		await tx
			.update(unitMergeOperation)
			.set({
				state: terminal ? "failed" : "retry_wait",
				attemptCount,
				availableAt: terminal
					? now
					: new Date(now.getTime() + unitMergeRetryDelayMilliseconds(attemptCount, Math.random())),
				leaseToken: null,
				leaseExpiresAt: null,
				lastErrorCode: failure.code,
				lastErrorMessage: failure.message,
				updatedAt: now,
			})
			.where(eq(unitMergeOperation.id, claimed.id));
		if (!terminal) return;
		await tx
			.update(unitMergeRequest)
			.set({ state: "failed", failedAt: now, updatedAt: now })
			.where(eq(unitMergeRequest.id, claimed.requestId));
		await recordSystemMergeAudit(tx, {
			action: "unit.merge.execution.failed",
			outcome: "failed",
			requestId: claimed.requestId,
			sourceUnitId: claimed.sourceUnitId,
			targetUnitId: claimed.targetUnitId,
			details: {
				operationId: claimed.id,
				phase: claimed.phase,
				attemptCount,
				errorCode: failure.code,
			},
		});
	});
}

async function yieldClaimedOperation(claimed: ClaimedUnitMergeOperation): Promise<void> {
	const now = new Date();
	await database
		.update(unitMergeOperation)
		.set({
			state: "pending",
			availableAt: now,
			leaseToken: null,
			leaseExpiresAt: null,
			updatedAt: now,
		})
		.where(
			and(
				eq(unitMergeOperation.id, claimed.id),
				eq(unitMergeOperation.state, "processing"),
				eq(unitMergeOperation.leaseToken, claimed.leaseToken),
			),
		);
}

async function drainClaimedOperation(claimed: ClaimedUnitMergeOperation): Promise<void> {
	let phase = claimed.phase;
	try {
		for (let step = 0; step < MaximumStepsPerDispatch; step += 1) {
			const result = await processClaimedStep(claimed, phase);
			if (result.outcome !== "continue") return;
			phase = result.phase;
		}
		await yieldClaimedOperation(claimed);
	} catch (error) {
		await markClaimedFailure({ ...claimed, phase }, error);
	}
}

/** Claims independent operations and advances each through bounded transactions. */
export async function dispatchUnitMergeBatch(now = new Date()): Promise<number> {
	const claimed = await claimUnitMergeOperations(now);
	await Promise.all(claimed.map((operation) => drainClaimedOperation(operation)));
	return claimed.length;
}
