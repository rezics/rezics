import {
	UnitMergeOperationPhaseValues,
	type UnitMergeOperationPhase,
} from "@rezics/schema/postgres/shared/contract-values";
export const UnitMergePolicy = {
	version: 1,
	requiredApprovals: 2,
	vetoEnabled: true,
	selfReviewForbidden: true,
	requestLifetimeMs: 7 * 24 * 60 * 60 * 1000,
	workerBatchSize: 8,
	inventoryBatchSize: 128,
	workerLeaseDurationMs: 60000,
	workerClaimBatchSize: 4,
	workerMaximumAutomaticAttempts: 12,
} as const;
export const unitMergeRequestExpiry = (now: Date) =>
	new Date(now.getTime() + UnitMergePolicy.requestLifetimeMs);
export function nextUnitMergePhase(phase: UnitMergeOperationPhase): UnitMergeOperationPhase | null {
	const index = UnitMergeOperationPhaseValues.indexOf(phase);
	return UnitMergeOperationPhaseValues[index + 1] ?? null;
}
export function unitMergeRetryDelayMilliseconds(attemptCount: number, jitter: number) {
	const step = Math.max(1, Math.min(attemptCount, 12));
	return (
		Math.min(2000 * 2 ** (step - 1), 600000) +
		Math.floor(Math.max(0, Math.min(jitter, 0.999999)) * 1000)
	);
}
