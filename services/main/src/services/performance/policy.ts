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
		maxResultWindow: 10_000,
		statementTimeoutMs: 1_500,
		statementTimeoutCeilingMs: 10_000,
		maxFacetScan: 1_000,
		maxFacetScanCeiling: 10_000,
	},
	account: {
		maxActiveSessionCountScan: 1_001,
		maxActiveTokens: 1_000,
	},
	quota: {
		maxConcurrentRequests: 1_000,
	},
	count: {
		maxCreditedBookCountScan: 1_001,
		maxPublicProgressCountScan: 1_001,
	},
	recommendation: {
		minimumRefreshIntervalMs: 86_400_000,
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
		maxRefreshBatchUnits: 500,
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
