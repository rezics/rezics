import type { SearchProjectionKind } from "../src/services/search/settings";

declare const searchIndexUidBrand: unique symbol;

export type SearchIndexUid = string & { readonly [searchIndexUidBrand]: true };

export interface SequinBackfill {
	readonly id: string;
	readonly table?: string;
	readonly state: string;
	readonly rowsInitialCount?: number;
	readonly rowsProcessedCount?: number;
}

export interface SequinSink {
	readonly name: string;
	readonly status: string;
	readonly healthStatus?: string;
	readonly sourceTables: readonly string[];
	readonly activeBackfills: readonly SequinBackfill[];
}

export type ProjectionProbeResult =
	| { readonly status: "ready"; readonly confirmedLsn: string }
	| { readonly status: "pending"; readonly reason: string }
	| {
			readonly status: "integrity_mismatch";
			readonly reason: string;
			readonly fingerprint: string;
	  };

export class ProjectionConfigurationError extends Error {
	override readonly name = "ProjectionConfigurationError";
}

export class ProjectionIntegrityError extends Error {
	override readonly name = "ProjectionIntegrityError";
}

export class ProjectionTimeoutError extends Error {
	override readonly name = "ProjectionTimeoutError";
}

export class MeilisearchTaskFailure extends Error {
	override readonly name = "MeilisearchTaskFailure";

	constructor(
		readonly taskUid: number,
		readonly status: "failed" | "canceled",
		readonly taskError: unknown,
		readonly errorCode: string | undefined,
	) {
		super(`Meilisearch task ${taskUid} ${status}: ${JSON.stringify(taskError)}`);
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function parseMeilisearchTask(value: unknown): {
	readonly status: string;
	readonly error: unknown;
	readonly errorCode?: string;
} {
	if (!isRecord(value) || typeof value.status !== "string")
		throw new TypeError("Invalid Meilisearch task response");
	const errorCode = isRecord(value.error) ? value.error.code : undefined;
	if (errorCode !== undefined && typeof errorCode !== "string")
		throw new TypeError("Invalid Meilisearch task error code");
	return {
		status: value.status,
		error: value.error,
		...(typeof errorCode === "string" ? { errorCode } : {}),
	};
}

export function isIndexAlreadyExistsFailure(value: unknown): boolean {
	return value instanceof MeilisearchTaskFailure && value.errorCode === "index_already_exists";
}

function optionalNonNegativeInteger(value: unknown): number | undefined {
	return Number.isInteger(value) && Number(value) >= 0 ? Number(value) : undefined;
}

function parseBackfill(value: unknown): SequinBackfill {
	if (!isRecord(value) || typeof value.id !== "string" || typeof value.state !== "string")
		throw new TypeError("Invalid Sequin backfill response");
	if (value.table !== undefined && value.table !== null && typeof value.table !== "string")
		throw new TypeError("Invalid Sequin backfill table");
	return {
		id: value.id,
		state: value.state,
		...(typeof value.table === "string" ? { table: value.table } : {}),
		...(optionalNonNegativeInteger(value.rows_initial_count) === undefined
			? {}
			: { rowsInitialCount: Number(value.rows_initial_count) }),
		...(optionalNonNegativeInteger(value.rows_processed_count) === undefined
			? {}
			: { rowsProcessedCount: Number(value.rows_processed_count) }),
	};
}

export function parseSequinBackfill(value: unknown): SequinBackfill {
	return parseBackfill(value);
}

export function parseSequinSinks(value: unknown): readonly SequinSink[] {
	if (!isRecord(value) || !Array.isArray(value.data))
		throw new TypeError("Invalid Sequin sink response");
	return value.data.map((item) => {
		if (!isRecord(item) || typeof item.name !== "string" || typeof item.status !== "string")
			throw new TypeError("Invalid Sequin sink entry");
		const source = item.source;
		if (source !== undefined && source !== null && !isRecord(source))
			throw new TypeError("Invalid Sequin sink source");
		const includeTables = isRecord(source) ? source.include_tables : undefined;
		if (
			includeTables !== undefined &&
			includeTables !== null &&
			(!Array.isArray(includeTables) ||
				includeTables.some((table) => typeof table !== "string"))
		)
			throw new TypeError("Invalid Sequin sink source tables");
		const activeBackfills = item.active_backfills;
		if (activeBackfills !== undefined && !Array.isArray(activeBackfills))
			throw new TypeError("Invalid Sequin active backfills");
		const health = item.health;
		if (health !== undefined && health !== null && !isRecord(health))
			throw new TypeError("Invalid Sequin sink health");
		const healthStatus = isRecord(health) ? health.status : undefined;
		if (healthStatus !== undefined && typeof healthStatus !== "string")
			throw new TypeError("Invalid Sequin sink health status");
		return {
			name: item.name,
			status: item.status,
			...(typeof healthStatus === "string" ? { healthStatus } : {}),
			sourceTables: Array.isArray(includeTables) ? includeTables : [],
			activeBackfills: Array.isArray(activeBackfills)
				? activeBackfills.map(parseBackfill)
				: [],
		};
	});
}

export function parseSearchIndexUid(kind: SearchProjectionKind, value: string): SearchIndexUid {
	const prefix = kind === "current" ? "rezics_units" : "rezics_revisions";
	if (!new RegExp(`^${prefix}_v[1-9][0-9]*_[0-9]{8}(?:_[0-9]{6})?$`).test(value))
		throw new TypeError(
			`Index UID must match ${prefix}_v<version>_<YYYYMMDD>[_<HHMMSS>]; received ${value}`,
		);
	return value as SearchIndexUid;
}

export function assertLocalLifecycleTargets(targets: {
	readonly databaseUrl: string;
	readonly meilisearchUrl: string;
	readonly sequinUrl: string;
}): void {
	for (const [name, value] of Object.entries(targets)) {
		const hostname = new URL(value).hostname;
		if (hostname !== "localhost" && hostname !== "127.0.0.1" && hostname !== "[::1]")
			throw new ProjectionConfigurationError(
				`Local search rebuild refuses non-loopback ${name}: ${hostname}`,
			);
	}
}

export async function waitForProjectionReady(options: {
	readonly indexUid: SearchIndexUid;
	readonly probe: () => Promise<ProjectionProbeResult>;
	readonly timeoutMs: number;
	readonly integrityGraceMs: number;
	readonly pollIntervalMs: number;
	readonly progressIntervalMs: number;
	readonly now?: () => number;
	readonly sleep?: (milliseconds: number) => Promise<void>;
	readonly report?: (message: string) => void;
}): Promise<string> {
	const now = options.now ?? Date.now;
	const sleep =
		options.sleep ??
		((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
	const report = options.report ?? console.info;
	const startedAt = now();
	let lastReportedAt = Number.NEGATIVE_INFINITY;
	let lastReason: string | undefined;
	let mismatch:
		| {
				readonly fingerprint: string;
				readonly firstObservedAt: number;
				readonly reason: string;
		  }
		| undefined;

	while (true) {
		const result = await options.probe();
		const observedAt = now();
		if (result.status === "ready") return result.confirmedLsn;

		if (result.status === "integrity_mismatch") {
			mismatch =
				mismatch?.fingerprint === result.fingerprint
					? mismatch
					: {
							fingerprint: result.fingerprint,
							firstObservedAt: observedAt,
							reason: result.reason,
						};
			if (observedAt - mismatch.firstObservedAt >= options.integrityGraceMs)
				throw new ProjectionIntegrityError(
					`Projection ${options.indexUid} is inconsistent after ${Math.ceil(options.integrityGraceMs / 1_000)}s: ${mismatch.reason}`,
				);
		} else {
			mismatch = undefined;
		}

		const reason = result.reason;
		if (reason !== lastReason || observedAt - lastReportedAt >= options.progressIntervalMs) {
			report(`Waiting for ${options.indexUid}: ${reason}`);
			lastReason = reason;
			lastReportedAt = observedAt;
		}

		const elapsedMs = observedAt - startedAt;
		if (elapsedMs >= options.timeoutMs)
			throw new ProjectionTimeoutError(
				`Projection ${options.indexUid} did not catch up within ${Math.ceil(options.timeoutMs / 1_000)}s: ${reason}`,
			);
		await sleep(Math.min(options.pollIntervalMs, options.timeoutMs - elapsedMs));
	}
}
