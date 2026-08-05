/**
 * Server-owned limits for every online or resumable bounded-work path.
 *
 * @remarks
 * These values are part of the v1 operational contract. Raising a limit requires
 * new latency, memory, and high-cardinality query-plan evidence. Environment
 * configuration may select a smaller value, but must never exceed the ceiling.
 */
export const WorkPolicy = {
	localization: {
		maxLanguagesPerUnit: 7,
		maxBatchUnits: 500,
	},
	filter: {
		maxDepth: 12,
		maxNodes: 100,
		maxValuesPerPredicate: 50,
	},
	search: {
		maxInputExpressionDepth: 3,
		maxCompiledExpressionDepth: 6,
		maxExpressionNodes: 100,
		maxCategories: 10,
		maxContexts: 4,
		maxInjections: 50,
		maxFacets: 20,
		maxPageSize: 100,
		maxResultWindow: 200,
		candidateBatchSize: 100,
		maxCandidateBatchSize: 1_000,
		maxCandidateScan: 1_000,
		maxCandidateScanCeiling: 10_000,
		maxCandidateRounds: 4,
		maxCandidateRoundsCeiling: 10,
		candidateDeadlineMs: 1_500,
		candidateDeadlineCeilingMs: 10_000,
		maxFacetCandidateScan: 1_000,
		maxFacetCandidateScanCeiling: 10_000,
	},
	projection: {
		claimBatchSize: 100,
		maxClaimBatchSize: 500,
		maxAttempts: 8,
		leaseMs: 30_000,
		pollIntervalMs: 500,
		readinessLagMs: 5_000,
	},
	recommendation: {
		maxStructuralSignals: 32,
		maxStructuralDegree: 256,
		maxRawStructuralPeers: 8_192,
		maxEdgesPerUnit: 64,
		maxInterestsPerProfile: 50,
		maxRecentInteractionsPerProfile: 50,
		maxBehavioralPeersPerUnit: 64,
		maxObjectiveCandidates: 256,
		maxFollowCandidates: 60,
		maxOnlineCandidates: 512,
	},
	import: {
		defaultBatchSize: 500,
		maxBatchSize: 500,
	},
} as const;

function assertPolicyInvariants(): void {
	if (
		WorkPolicy.recommendation.maxRawStructuralPeers !==
		WorkPolicy.recommendation.maxStructuralSignals *
			WorkPolicy.recommendation.maxStructuralDegree
	)
		throw new Error("Recommendation structural budget is internally inconsistent");
	if (
		WorkPolicy.localization.maxBatchUnits * WorkPolicy.localization.maxLanguagesPerUnit !==
		3_500
	)
		throw new Error("Localization hydration budget is internally inconsistent");
}

assertPolicyInvariants();

export function requirePolicyBound(name: string, value: number, maximum: number): number {
	if (!Number.isSafeInteger(value) || value < 1 || value > maximum)
		throw new RangeError(`${name} must be a positive safe integer no greater than ${maximum}`);
	return value;
}
