import { apiReadinessPolicy } from "../../health-contract";
import { getRecommendationHealth } from "../recommendations/worker";
import { storage } from "../storage";
import { checkDatabase } from "./database";
import {
	createReadinessEvaluator,
	type HealthCheckDefinition,
	type ReadinessReport,
} from "./model";
import { createReadinessObserver } from "./observability";

export type ApiHealthCheckName = keyof typeof apiReadinessPolicy.checks;

export interface ApiReadinessDependencies {
	readonly database: (signal: AbortSignal) => Promise<boolean>;
	readonly storage: (signal: AbortSignal) => Promise<boolean>;
	readonly recommendations: (signal: AbortSignal) => Promise<boolean>;
}

const defaultDependencies: ApiReadinessDependencies = {
	database: checkDatabase,
	async storage(signal) {
		await storage.health(signal);
		return !signal.aborted;
	},
	async recommendations(signal) {
		const result = await getRecommendationHealth();
		return !signal.aborted && result.ready;
	},
};

export function apiReadinessDefinitions(
	dependencies: ApiReadinessDependencies,
): readonly HealthCheckDefinition<ApiHealthCheckName>[] {
	function definition<Name extends ApiHealthCheckName>(name: Name): HealthCheckDefinition<Name> {
		return {
			name,
			...apiReadinessPolicy.checks[name],
			probe: dependencies[name],
		};
	}
	return [definition("database"), definition("storage"), definition("recommendations")];
}

export function createApiReadinessEvaluator(
	dependencies: ApiReadinessDependencies,
	onFreshReport: (report: ReadinessReport<ApiHealthCheckName>) => void = createReadinessObserver(
		"api",
	),
) {
	return createReadinessEvaluator(apiReadinessDefinitions(dependencies), {
		overallTimeoutMs: apiReadinessPolicy.overallTimeoutMs,
		cacheTtlMs: apiReadinessPolicy.cacheTtlMs,
		onFreshReport,
	});
}

export const evaluateApiReadiness = createApiReadinessEvaluator(defaultDependencies);
