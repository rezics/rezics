import { type UnitMergeOperationPhase, UnitMergeOperationPhaseValues } from "../../database/schema";

/** Versioned centralized policy. Persistence stores this snapshot for audit. */
export const UnitMergePolicyV1 = {
	version: 1,
	requiredApprovals: 4,
	vetoEnabled: true,
	selfReviewForbidden: true,
	requestLifetimeMs: 7 * 24 * 60 * 60 * 1_000,
	manifestVersion: 1,
	workerBatchSize: 500,
	workerLeaseDurationMs: 60_000,
	workerClaimBatchSize: 4,
	workerMaximumAutomaticAttempts: 12,
} as const;

export function unitMergeRequestExpiry(now: Date): Date {
	return new Date(now.getTime() + UnitMergePolicyV1.requestLifetimeMs);
}

export function nextUnitMergePhase(phase: UnitMergeOperationPhase): UnitMergeOperationPhase | null {
	const index = UnitMergeOperationPhaseValues.indexOf(phase);
	return index < 0 || index === UnitMergeOperationPhaseValues.length - 1
		? null
		: (UnitMergeOperationPhaseValues[index + 1] ?? null);
}

export function unitMergeRetryDelayMilliseconds(attemptCount: number, jitter: number): number {
	const boundedAttempt = Math.max(1, Math.min(attemptCount, 12));
	const exponential = Math.min(2_000 * 2 ** (boundedAttempt - 1), 10 * 60_000);
	return exponential + Math.floor(Math.max(0, Math.min(jitter, 0.999_999)) * 1_000);
}
