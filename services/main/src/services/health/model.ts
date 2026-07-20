export const HealthCheckNameValues = [
	"database",
	"storage",
	"recommendations",
	"worker_loop",
] as const;
export type HealthCheckName = (typeof HealthCheckNameValues)[number];

export const HealthCheckStateValues = ["ready", "degraded", "unavailable"] as const;
export type HealthCheckState = (typeof HealthCheckStateValues)[number];

export const HealthFailureCategoryValues = [
	"configuration",
	"dependency",
	"not_ready",
	"timeout",
	"overall_timeout",
] as const;
export type HealthFailureCategory = (typeof HealthFailureCategoryValues)[number];

export type HealthCheckCriticality = "required" | "optional";
export type ReadinessStatus = "ready" | "unavailable";

export interface HealthCheckDefinition<Name extends HealthCheckName = HealthCheckName> {
	readonly name: Name;
	readonly criticality: HealthCheckCriticality;
	readonly timeoutMs: number;
	readonly probe: (signal: AbortSignal) => Promise<boolean>;
}

export interface HealthCheckResult<Name extends HealthCheckName = HealthCheckName> {
	readonly name: Name;
	readonly criticality: HealthCheckCriticality;
	readonly state: HealthCheckState;
	readonly latencyMs: number;
	readonly failureCategory?: HealthFailureCategory;
}

export interface ReadinessReport<Name extends HealthCheckName = HealthCheckName> {
	readonly status: ReadinessStatus;
	readonly checks: readonly HealthCheckResult<Name>[];
}

export class HealthCheckConfigurationError extends Error {
	constructor() {
		super("Health check configuration is unavailable");
		this.name = "HealthCheckConfigurationError";
	}
}

function resultState(criticality: HealthCheckCriticality, ready: boolean): HealthCheckState {
	if (ready) return "ready";
	return criticality === "required" ? "unavailable" : "degraded";
}

function failureCategory(error: unknown): HealthFailureCategory {
	return error instanceof HealthCheckConfigurationError ? "configuration" : "dependency";
}

function elapsedMillis(startedAt: number): number {
	return Math.max(0, Math.round(performance.now() - startedAt));
}

async function runCheck<Name extends HealthCheckName>(
	definition: HealthCheckDefinition<Name>,
): Promise<HealthCheckResult<Name>> {
	const startedAt = performance.now();
	const controller = new AbortController();
	let timer: ReturnType<typeof setTimeout> | undefined;
	const operation = Promise.resolve()
		.then(() => definition.probe(controller.signal))
		.then(
			(ready): HealthCheckResult<Name> => ({
				name: definition.name,
				criticality: definition.criticality,
				state: resultState(definition.criticality, ready),
				latencyMs: elapsedMillis(startedAt),
				...(ready ? {} : { failureCategory: "not_ready" }),
			}),
			(error: unknown): HealthCheckResult<Name> => ({
				name: definition.name,
				criticality: definition.criticality,
				state: resultState(definition.criticality, false),
				latencyMs: elapsedMillis(startedAt),
				failureCategory: failureCategory(error),
			}),
		);
	const timeout = new Promise<HealthCheckResult<Name>>((resolve) => {
		timer = setTimeout(() => {
			controller.abort();
			resolve({
				name: definition.name,
				criticality: definition.criticality,
				state: resultState(definition.criticality, false),
				latencyMs: elapsedMillis(startedAt),
				failureCategory: "timeout",
			});
		}, definition.timeoutMs);
		timer.unref?.();
	});
	const result = await Promise.race([operation, timeout]);
	if (timer) clearTimeout(timer);
	return result;
}

export function deriveReadiness<Name extends HealthCheckName>(
	checks: readonly HealthCheckResult<Name>[],
): ReadinessStatus {
	return checks.some((check) => check.criticality === "required" && check.state !== "ready")
		? "unavailable"
		: "ready";
}

export interface ReadinessEvaluatorOptions<Name extends HealthCheckName> {
	readonly overallTimeoutMs: number;
	readonly cacheTtlMs: number;
	readonly onFreshReport?: (report: ReadinessReport<Name>) => void;
}

function assertPolicy<Name extends HealthCheckName>(
	definitions: readonly HealthCheckDefinition<Name>[],
	options: ReadinessEvaluatorOptions<Name>,
): void {
	if (!Number.isSafeInteger(options.overallTimeoutMs) || options.overallTimeoutMs <= 0)
		throw new HealthCheckConfigurationError();
	if (!Number.isSafeInteger(options.cacheTtlMs) || options.cacheTtlMs < 0)
		throw new HealthCheckConfigurationError();
	const names = new Set<HealthCheckName>();
	for (const definition of definitions) {
		if (names.has(definition.name)) throw new HealthCheckConfigurationError();
		names.add(definition.name);
		if (
			!Number.isSafeInteger(definition.timeoutMs) ||
			definition.timeoutMs <= 0 ||
			definition.timeoutMs >= options.overallTimeoutMs
		)
			throw new HealthCheckConfigurationError();
	}
}

export function createReadinessEvaluator<Name extends HealthCheckName>(
	definitions: readonly HealthCheckDefinition<Name>[],
	options: ReadinessEvaluatorOptions<Name>,
): () => Promise<ReadinessReport<Name>> {
	assertPolicy(definitions, options);
	let inFlight: Promise<ReadinessReport<Name>> | undefined;
	let cached: { readonly expiresAt: number; readonly report: ReadinessReport<Name> } | undefined;

	async function evaluateFresh(): Promise<ReadinessReport<Name>> {
		const startedAt = performance.now();
		const settled = new Map<Name, HealthCheckResult<Name>>();
		const operations = definitions.map(async (definition) => {
			const result = await runCheck(definition);
			settled.set(definition.name, result);
		});
		let timer: ReturnType<typeof setTimeout> | undefined;
		const deadline = new Promise<"timeout">((resolve) => {
			timer = setTimeout(() => resolve("timeout"), options.overallTimeoutMs);
			timer.unref?.();
		});
		const completion = Promise.all(operations).then(() => "complete" as const);
		const outcome = await Promise.race([completion, deadline]);
		if (timer) clearTimeout(timer);

		const checks = definitions.map((definition): HealthCheckResult<Name> => {
			const result = settled.get(definition.name);
			if (result) return result;
			return {
				name: definition.name,
				criticality: definition.criticality,
				state: resultState(definition.criticality, false),
				latencyMs: elapsedMillis(startedAt),
				failureCategory: outcome === "timeout" ? "overall_timeout" : "dependency",
			};
		});
		const report = { status: deriveReadiness(checks), checks } as const;
		try {
			options.onFreshReport?.(report);
		} catch {
			// Telemetry is best-effort and cannot change whether the process receives work.
		}
		return report;
	}

	return async () => {
		const now = Date.now();
		if (cached && now < cached.expiresAt) return cached.report;
		if (inFlight) return inFlight;
		inFlight = evaluateFresh().then((report) => {
			cached = { expiresAt: Date.now() + options.cacheTtlMs, report };
			return report;
		});
		try {
			return await inFlight;
		} finally {
			inFlight = undefined;
		}
	};
}
