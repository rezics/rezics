import { Client } from "pg";
import { and, eq, inArray, ne, sql } from "drizzle-orm";

import { env } from "../src/services/config";
import { database, type DatabaseExecutor } from "../src/services/database";
import {
	searchIndexGeneration,
	searchRevisionProjectionSource,
	searchUnitProjectionSource,
	type SearchIndexGenerationState,
} from "../src/services/database/schema";
import {
	CurrentSearchNonStructureUnitKinds,
	parseCurrentSearchDocument,
	parseRevisionSearchDocument,
	SearchProjectionVersions,
} from "../src/services/search/contracts";
import { clearActiveSearchGenerationCache } from "../src/services/search/generation";
import {
	getSearchSettingsFingerprint,
	SearchProjectionSettings,
	type SearchProjectionKind,
} from "../src/services/search/settings";
import {
	assertLocalLifecycleTargets,
	isIndexAlreadyExistsFailure,
	MeilisearchTaskFailure,
	parseMeilisearchTask,
	parseSearchIndexUid,
	parseSequinBackfill,
	parseSequinSinks,
	ProjectionConfigurationError,
	type ProjectionProbeResult,
	type SearchIndexUid,
	type SequinSink,
	waitForProjectionReady,
} from "./search-index-support";

const DefaultReconcileTimeoutMs = 30 * 60 * 1_000;
const DefaultCheckTimeoutMs = 60_000;
const IntegrityGraceMs = 15_000;
const PollIntervalMs = 1_000;
const ProgressIntervalMs = 5_000;

type Action = "check" | "prepare" | "rebuild-local" | "reconcile" | "promote" | "retire";

interface Options {
	readonly action: Action;
	readonly projection: SearchProjectionKind;
	readonly indexUid?: SearchIndexUid;
	readonly timeoutMs: number;
	readonly confirmed: boolean;
}

interface DocumentVerificationReady {
	readonly status: "ready";
}

type DocumentVerification =
	| DocumentVerificationReady
	| { readonly status: "pending"; readonly reason: string }
	| {
			readonly status: "integrity_mismatch";
			readonly reason: string;
			readonly fingerprint: string;
	  };

function requiredEnvironment(name: string, value: string | undefined): string {
	if (!value) throw new ProjectionConfigurationError(`${name} is required by search lifecycle`);
	return value;
}

const databaseUrl = requiredEnvironment("DATABASE_URL", env.DATABASE_URL);
const meilisearchUrl = requiredEnvironment("MEILISEARCH_URL", env.MEILISEARCH_URL);
const reconcilerKey = requiredEnvironment(
	"MEILISEARCH_RECONCILER_KEY",
	env.MEILISEARCH_RECONCILER_KEY,
);
const sequinUrl = requiredEnvironment("SEQUIN_URL", env.SEQUIN_URL);
const sequinApiToken = requiredEnvironment("SEQUIN_API_TOKEN", env.SEQUIN_API_TOKEN);

function parseOptions(arguments_: readonly string[]): Options {
	const [actionValue, ...flags] = arguments_;
	if (
		actionValue !== "check" &&
		actionValue !== "prepare" &&
		actionValue !== "rebuild-local" &&
		actionValue !== "reconcile" &&
		actionValue !== "promote" &&
		actionValue !== "retire"
	)
		throw new TypeError(
			"Usage: search-index check|prepare|rebuild-local|reconcile|promote|retire --projection current|history [--index UID] [--timeout-seconds N] [--yes]",
		);

	let projection: SearchProjectionKind | undefined;
	let rawIndexUid: string | undefined;
	let timeoutMs = actionValue === "check" ? DefaultCheckTimeoutMs : DefaultReconcileTimeoutMs;
	let confirmed = false;
	for (let index = 0; index < flags.length; index += 1) {
		const flag = flags[index];
		if (flag === "--yes") {
			confirmed = true;
			continue;
		}
		if (flag !== "--projection" && flag !== "--index" && flag !== "--timeout-seconds")
			throw new TypeError(`Unknown search lifecycle option: ${flag}`);
		const value = flags[index + 1];
		if (!value || value.startsWith("--")) throw new TypeError(`${flag} requires a value`);
		index += 1;
		if (flag === "--projection") {
			if (value !== "current" && value !== "history")
				throw new TypeError("--projection must be current or history");
			projection = value;
		} else if (flag === "--index") {
			rawIndexUid = value;
		} else {
			const seconds = Number(value);
			if (!Number.isSafeInteger(seconds) || seconds < 10 || seconds > 86_400)
				throw new TypeError("--timeout-seconds must be an integer between 10 and 86400");
			timeoutMs = seconds * 1_000;
		}
	}
	if (!projection) throw new TypeError("--projection must be current or history");
	const indexUid = rawIndexUid ? parseSearchIndexUid(projection, rawIndexUid) : undefined;
	if (
		(actionValue === "promote" ||
			actionValue === "retire" ||
			actionValue === "rebuild-local") &&
		!indexUid
	)
		throw new TypeError(`${actionValue} requires --index UID`);
	if (confirmed && actionValue !== "rebuild-local")
		throw new TypeError("--yes is only valid for rebuild-local");
	return { action: actionValue, projection, indexUid, timeoutMs, confirmed };
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function formatCause(cause: unknown): string {
	return cause instanceof Error ? cause.message : "unknown failure";
}

async function meilisearchRequest(path: string, init: RequestInit = {}): Promise<unknown> {
	let response: Response;
	try {
		response = await fetch(`${meilisearchUrl}${path}`, {
			...init,
			headers: {
				Authorization: `Bearer ${reconcilerKey}`,
				"Content-Type": "application/json",
				...init.headers,
			},
			signal: AbortSignal.timeout(30_000),
		});
	} catch (cause) {
		throw new Error(`Meilisearch ${init.method ?? "GET"} ${path} failed`, { cause });
	}
	const body: unknown = await response.json().catch(() => undefined);
	if (!response.ok) {
		const message = `Meilisearch ${init.method ?? "GET"} ${path} failed with ${response.status}`;
		if (
			response.status >= 400 &&
			response.status < 500 &&
			response.status !== 408 &&
			response.status !== 429
		)
			throw new ProjectionConfigurationError(message);
		throw new Error(message);
	}
	return body;
}

async function waitForMeilisearchTask(taskUid: number): Promise<void> {
	for (let attempt = 0; attempt < 2_400; attempt += 1) {
		const task = parseMeilisearchTask(await meilisearchRequest(`/tasks/${taskUid}`));
		if (task.status === "succeeded") return;
		if (task.status === "failed" || task.status === "canceled")
			throw new MeilisearchTaskFailure(taskUid, task.status, task.error, task.errorCode);
		if (attempt > 0 && attempt % 20 === 0)
			console.info(`Waiting for Meilisearch task ${taskUid}: ${task.status}`);
		await new Promise((resolve) => setTimeout(resolve, 250));
	}
	throw new Error(`Meilisearch task ${taskUid} timed out after 600s`);
}

async function meilisearchTaskRequest(path: string, init: RequestInit): Promise<void> {
	const body = await meilisearchRequest(path, init);
	if (!isRecord(body) || typeof body.taskUid !== "number")
		throw new TypeError("Meilisearch mutation did not return a task UID");
	await waitForMeilisearchTask(body.taskUid);
}

async function sequinRequest(path: string, init: RequestInit = {}): Promise<unknown> {
	let response: Response;
	try {
		response = await fetch(`${sequinUrl}${path}`, {
			...init,
			headers: {
				Authorization: `Bearer ${sequinApiToken}`,
				"Content-Type": "application/json",
				...init.headers,
			},
			signal: AbortSignal.timeout(30_000),
		});
	} catch (cause) {
		throw new Error(`Sequin ${init.method ?? "GET"} ${path} failed`, { cause });
	}
	const body: unknown = await response.json().catch(() => undefined);
	if (!response.ok) {
		const message = `Sequin ${init.method ?? "GET"} ${path} failed with ${response.status}`;
		if (
			response.status >= 400 &&
			response.status < 500 &&
			response.status !== 408 &&
			response.status !== 429
		)
			throw new ProjectionConfigurationError(message);
		throw new Error(message);
	}
	return body;
}

function defaultIndexUid(kind: SearchProjectionKind): SearchIndexUid {
	const prefix = kind === "current" ? "rezics_units" : "rezics_revisions";
	const timestamp = new Date()
		.toISOString()
		.replaceAll(/[-:]/g, "")
		.replace("T", "_")
		.slice(0, 15);
	return parseSearchIndexUid(kind, `${prefix}_v${SearchProjectionVersions[kind]}_${timestamp}`);
}

function sourceTableFor(kind: SearchProjectionKind): string {
	return kind === "current"
		? "public.search_unit_projection_source"
		: "public.search_revision_projection_source";
}

async function withProjectionLock<T>(
	kind: SearchProjectionKind,
	work: () => Promise<T>,
): Promise<T> {
	const client = new Client({ connectionString: databaseUrl });
	await client.connect();
	const lockKey = `search-index:${kind}`;
	try {
		const result = await client.query<{ acquired: boolean }>(
			"select pg_try_advisory_lock(hashtextextended($1, 0)) as acquired",
			[lockKey],
		);
		if (result.rows[0]?.acquired !== true)
			throw new ProjectionConfigurationError(
				`Another ${kind} search lifecycle command already holds the projection lock`,
			);
		try {
			return await work();
		} finally {
			await client.query("select pg_advisory_unlock(hashtextextended($1, 0))", [lockKey]);
		}
	} finally {
		await client.end();
	}
}

async function findGeneration(kind: SearchProjectionKind, indexUid: SearchIndexUid) {
	const [generation] = await database
		.select({
			id: searchIndexGeneration.id,
			state: searchIndexGeneration.state,
			projectionVersion: searchIndexGeneration.projectionVersion,
			settingsFingerprint: searchIndexGeneration.settingsFingerprint,
			lastVerifiedLsn: searchIndexGeneration.lastVerifiedLsn,
			failure: searchIndexGeneration.failure,
		})
		.from(searchIndexGeneration)
		.where(
			and(
				eq(searchIndexGeneration.projectionKind, kind),
				eq(searchIndexGeneration.indexUid, indexUid),
			),
		)
		.limit(1);
	return generation;
}

type Generation = NonNullable<Awaited<ReturnType<typeof findGeneration>>>;

function assertCompatibleGeneration(
	generation: Generation,
	kind: SearchProjectionKind,
	fingerprint: string,
): void {
	if (
		generation.projectionVersion !== SearchProjectionVersions[kind] ||
		generation.settingsFingerprint !== fingerprint
	)
		throw new ProjectionConfigurationError(
			"An existing generation cannot be mutated to a different contract or settings fingerprint; use a new versioned index UID",
		);
}

async function indexExists(indexUid: SearchIndexUid): Promise<boolean> {
	const response = await fetch(`${meilisearchUrl}/indexes/${encodeURIComponent(indexUid)}`, {
		headers: { Authorization: `Bearer ${reconcilerKey}` },
		signal: AbortSignal.timeout(5_000),
	});
	if (response.status === 404) return false;
	if (!response.ok)
		throw new Error(`Unable to inspect Meilisearch index ${indexUid}: ${response.status}`);
	return true;
}

async function createIndex(indexUid: SearchIndexUid): Promise<void> {
	try {
		await meilisearchTaskRequest("/indexes", {
			method: "POST",
			body: JSON.stringify({ uid: indexUid, primaryKey: "id" }),
		});
	} catch (cause) {
		if (!isIndexAlreadyExistsFailure(cause)) throw cause;
	}
}

async function ensureIndex(indexUid: SearchIndexUid): Promise<void> {
	if (!(await indexExists(indexUid))) await createIndex(indexUid);
}

async function deleteIndex(indexUid: SearchIndexUid): Promise<void> {
	if (!(await indexExists(indexUid))) return;
	await meilisearchTaskRequest(`/indexes/${encodeURIComponent(indexUid)}`, { method: "DELETE" });
}

async function applySettings(kind: SearchProjectionKind, indexUid: SearchIndexUid): Promise<void> {
	await meilisearchTaskRequest(`/indexes/${encodeURIComponent(indexUid)}/settings`, {
		method: "PATCH",
		body: JSON.stringify(SearchProjectionSettings[kind]),
	});
}

async function listSequinSinks(): Promise<readonly SequinSink[]> {
	return parseSequinSinks(await sequinRequest("/api/sinks"));
}

function requireSequinSink(
	sinks: readonly SequinSink[],
	sinkName: string,
	sourceTable: string,
): SequinSink {
	const sink = sinks.find((candidate) => candidate.name === sinkName);
	if (!sink) throw new ProjectionConfigurationError(`Sequin sink ${sinkName} is not applied`);
	if (sink.status !== "active")
		throw new ProjectionConfigurationError(`Sequin sink ${sinkName} is not active`);
	if (!sink.sourceTables.includes(sourceTable))
		throw new ProjectionConfigurationError(
			`Sequin sink ${sinkName} does not source ${sourceTable}`,
		);
	return sink;
}

async function cancelBackfill(sinkName: string, backfillId: string): Promise<void> {
	await sequinRequest(
		`/api/sinks/${encodeURIComponent(sinkName)}/backfills/${encodeURIComponent(backfillId)}`,
		{ method: "PATCH", body: JSON.stringify({ state: "cancelled" }) },
	);
}

async function createBackfill(sinkName: string, sourceTable: string): Promise<string> {
	const backfill = parseSequinBackfill(
		await sequinRequest(`/api/sinks/${encodeURIComponent(sinkName)}/backfills`, {
			method: "POST",
			body: JSON.stringify({ table: sourceTable }),
		}),
	);
	return backfill.id;
}

async function confirmedSlotLsn(watermark: string): Promise<string | undefined> {
	const result = await database.execute<{ confirmed_lsn: string | null; caught_up: boolean }>(
		sql`select confirmed_flush_lsn::text as confirmed_lsn,
			coalesce(confirmed_flush_lsn >= ${watermark}::pg_lsn, false) as caught_up
		from pg_replication_slots
		where slot_name = 'rezics_search_projection_slot'`,
	);
	const slot = result.rows[0];
	return slot?.caught_up && slot.confirmed_lsn ? slot.confirmed_lsn : undefined;
}

async function captureWatermark(): Promise<{ readonly lsn: string; readonly capturedAt: Date }> {
	const result = await database.execute<{ lsn: unknown; captured_at: unknown }>(
		sql`select pg_current_wal_lsn()::text as lsn, clock_timestamp() as captured_at`,
	);
	const row = result.rows[0];
	if (!row || typeof row.lsn !== "string")
		throw new TypeError("Unable to capture search source WAL watermark");
	const capturedAt =
		row.captured_at instanceof Date
			? row.captured_at
			: typeof row.captured_at === "string"
				? new Date(row.captured_at)
				: undefined;
	if (!capturedAt || Number.isNaN(capturedAt.valueOf()))
		throw new TypeError("PostgreSQL returned an invalid WAL watermark timestamp");
	return { lsn: row.lsn, capturedAt };
}

async function setState(
	executor: DatabaseExecutor,
	id: string,
	state: SearchIndexGenerationState,
	values: Partial<typeof searchIndexGeneration.$inferInsert> = {},
): Promise<void> {
	await executor
		.update(searchIndexGeneration)
		.set({ ...values, state })
		.where(eq(searchIndexGeneration.id, id));
}

async function markFailed(id: string, cause: unknown): Promise<void> {
	await setState(database, id, "failed", {
		failure: formatCause(cause).slice(0, 2_000),
	});
}

async function verifyDocuments(
	kind: SearchProjectionKind,
	indexUid: SearchIndexUid,
): Promise<DocumentVerification> {
	const stats = await meilisearchRequest(`/indexes/${encodeURIComponent(indexUid)}/stats`);
	if (!isRecord(stats) || !Number.isSafeInteger(stats.numberOfDocuments))
		throw new TypeError("Invalid Meilisearch index stats response");
	const countResult = await database.execute<{ count: string }>(
		kind === "current"
			? sql`select count(*)::text as count
					from search_unit_projection_source source
					join unit on unit.id = source.unit_id
					where unit.kind in (${sql.join(
						CurrentSearchNonStructureUnitKinds.map((kind) => sql`${kind}`),
						sql`, `,
					)})
						or (
							unit.kind = 'structure'
						and exists (
							select 1
							from unit_structure_vote_stat definition_stat
							where definition_stat.structure_id = source.unit_id
								and definition_stat.score > 0
						)
						and not exists (
							select 1
							from unit_structure_member member
							join unit member_unit on member_unit.id = member.member_unit_id
							where member.structure_id = source.unit_id
								and (
									member_unit.kind <> 'tag'
									or member_unit.status <> 'published'
									or member_unit.visibility <> 'public'
									or member_unit.moderation_status <> 'approved'
									or member_unit.deleted_at is not null
								)
						)
					)`
			: sql`select count(*)::text as count from search_revision_projection_source source join unit_revision revision on revision.id = source.revision_id where not revision.suppressed`,
	);
	const expected = Number(countResult.rows[0]?.count ?? "0");
	if (!Number.isSafeInteger(expected) || expected < 0)
		throw new TypeError("Invalid PostgreSQL projection document count");
	if (stats.numberOfDocuments !== expected)
		return {
			status: "integrity_mismatch",
			reason: `index has ${stats.numberOfDocuments} documents; PostgreSQL expects ${expected}`,
			fingerprint: `count:${stats.numberOfDocuments}:${expected}`,
		};
	if (expected === 0) return { status: "ready" };

	const documents = await meilisearchRequest(
		`/indexes/${encodeURIComponent(indexUid)}/documents?limit=20`,
	);
	if (!isRecord(documents) || !Array.isArray(documents.results))
		throw new TypeError("Invalid Meilisearch documents response");
	const parsed = documents.results.map((document) =>
		kind === "current"
			? parseCurrentSearchDocument(document)
			: parseRevisionSearchDocument(document),
	);
	const ids = parsed.map((document) => document.id);
	const sourceRows =
		kind === "current"
			? await database
					.select({
						id: searchUnitProjectionSource.unitId,
						revision: searchUnitProjectionSource.revision,
					})
					.from(searchUnitProjectionSource)
					.where(inArray(searchUnitProjectionSource.unitId, ids))
			: await database
					.select({
						id: searchRevisionProjectionSource.revisionId,
						revision: searchRevisionProjectionSource.revision,
					})
					.from(searchRevisionProjectionSource)
					.where(inArray(searchRevisionProjectionSource.revisionId, ids));
	const expectedRevisions = new Map(
		sourceRows.map((row) => [row.id, Number(row.revision)] as const),
	);
	for (const document of parsed) {
		const expectedRevision = expectedRevisions.get(document.id);
		if (expectedRevision === undefined)
			return {
				status: "integrity_mismatch",
				reason: `index contains stale document ${document.id} missing from PostgreSQL`,
				fingerprint: `${document.id}:missing`,
			};
		if (expectedRevision !== document.revision)
			return {
				status: "integrity_mismatch",
				reason: `document ${document.id} has revision ${document.revision}; PostgreSQL expects ${expectedRevision}`,
				fingerprint: `${document.id}:${document.revision}:${expectedRevision}`,
			};
	}
	return { status: "ready" };
}

async function probeProjection(
	kind: SearchProjectionKind,
	indexUid: SearchIndexUid,
	watermark: string,
): Promise<ProjectionProbeResult> {
	try {
		const sinkName = indexUid.replaceAll("_", "-");
		const sink = requireSequinSink(await listSequinSinks(), sinkName, sourceTableFor(kind));
		if (sink.activeBackfills.length > 0) {
			const backfill = sink.activeBackfills[0];
			if (!backfill) throw new TypeError("Sequin reported an empty active backfill list");
			const progress =
				backfill.rowsProcessedCount === undefined
					? "progress unavailable"
					: `${backfill.rowsProcessedCount}/${backfill.rowsInitialCount ?? "?"} rows`;
			return {
				status: "pending",
				reason: `Sequin backfill ${backfill.id} is active (${progress})`,
			};
		}
		if (sink.healthStatus !== "healthy")
			return {
				status: "pending",
				reason: `Sequin sink ${sinkName} health is ${sink.healthStatus ?? "unknown"}`,
			};
		const confirmedLsn = await confirmedSlotLsn(watermark);
		if (!confirmedLsn)
			return {
				status: "pending",
				reason: `Sequin has not consumed WAL watermark ${watermark}`,
			};
		const documents = await verifyDocuments(kind, indexUid);
		return documents.status === "ready" ? { status: "ready", confirmedLsn } : documents;
	} catch (cause) {
		if (cause instanceof ProjectionConfigurationError || cause instanceof TypeError)
			throw cause;
		return { status: "pending", reason: formatCause(cause) };
	}
}

async function waitForCatchUp(
	kind: SearchProjectionKind,
	indexUid: SearchIndexUid,
	watermark: string,
	timeoutMs: number,
): Promise<string> {
	return waitForProjectionReady({
		indexUid,
		probe: () => probeProjection(kind, indexUid, watermark),
		timeoutMs,
		integrityGraceMs: IntegrityGraceMs,
		pollIntervalMs: PollIntervalMs,
		progressIntervalMs: ProgressIntervalMs,
	});
}

async function prepare(options: Options): Promise<void> {
	const kind = options.projection;
	const indexUid = options.indexUid ?? defaultIndexUid(kind);
	const fingerprint = getSearchSettingsFingerprint(kind);
	await withProjectionLock(kind, async () => {
		let generation = await findGeneration(kind, indexUid);
		let needsIndexCreation = false;
		if (generation) {
			assertCompatibleGeneration(generation, kind, fingerprint);
			if (generation.state === "failed")
				throw new ProjectionConfigurationError(
					`Generation ${indexUid} is failed (${generation.failure ?? "no reason recorded"}); use a new UID or run the confirmed local rebuild`,
				);
			if (generation.state === "retired")
				throw new ProjectionConfigurationError(
					`Retired generation ${indexUid} cannot be prepared again`,
				);
			if (!(await indexExists(indexUid))) {
				if (generation.state === "active" || generation.state === "verified")
					throw new ProjectionConfigurationError(
						`Generation ${indexUid} is ${generation.state} but its Meilisearch index is missing; use a new UID`,
					);
				needsIndexCreation = true;
			}
			if (generation.state === "active" || generation.state === "verified") return;
			await setState(database, generation.id, "building", { failure: null });
		} else {
			if (await indexExists(indexUid))
				throw new ProjectionConfigurationError(
					`Meilisearch index ${indexUid} exists without PostgreSQL generation metadata; refusing unsafe reuse. Use a new UID or run task local:search:rebuild`,
				);
			[generation] = await database
				.insert(searchIndexGeneration)
				.values({
					projectionKind: kind,
					indexUid,
					projectionVersion: SearchProjectionVersions[kind],
					settingsFingerprint: fingerprint,
					sequinSinkName: indexUid.replaceAll("_", "-"),
					state: "building",
				})
				.returning({
					id: searchIndexGeneration.id,
					state: searchIndexGeneration.state,
					projectionVersion: searchIndexGeneration.projectionVersion,
					settingsFingerprint: searchIndexGeneration.settingsFingerprint,
					lastVerifiedLsn: searchIndexGeneration.lastVerifiedLsn,
					failure: searchIndexGeneration.failure,
				});
			if (!generation) throw new Error("Search generation declaration returned no row");
			needsIndexCreation = true;
		}
		try {
			if (needsIndexCreation) await createIndex(indexUid);
			await applySettings(kind, indexUid);
			console.info(`Prepared ${kind} search generation ${indexUid}`);
		} catch (cause) {
			await markFailed(generation.id, cause);
			throw cause;
		}
	});
}

async function reconcile(options: Options): Promise<void> {
	const kind = options.projection;
	const indexUid = options.indexUid ?? defaultIndexUid(kind);
	const fingerprint = getSearchSettingsFingerprint(kind);
	await withProjectionLock(kind, async () => {
		let generation = await findGeneration(kind, indexUid);
		const stableGeneration = generation?.state === "active" || generation?.state === "verified";
		if (generation) {
			assertCompatibleGeneration(generation, kind, fingerprint);
			if (generation.state === "failed")
				throw new ProjectionConfigurationError(
					`Generation ${indexUid} is failed (${generation.failure ?? "no reason recorded"}); use a new UID or run the confirmed local rebuild`,
				);
			if (generation.state === "retired")
				throw new ProjectionConfigurationError(
					`Retired generation ${indexUid} cannot be reconciled`,
				);
		} else {
			if (await indexExists(indexUid))
				throw new ProjectionConfigurationError(
					`Meilisearch index ${indexUid} exists without PostgreSQL generation metadata; refusing unsafe reuse`,
				);
			[generation] = await database
				.insert(searchIndexGeneration)
				.values({
					projectionKind: kind,
					indexUid,
					projectionVersion: SearchProjectionVersions[kind],
					settingsFingerprint: fingerprint,
					sequinSinkName: indexUid.replaceAll("_", "-"),
					state: "building",
				})
				.returning({
					id: searchIndexGeneration.id,
					state: searchIndexGeneration.state,
					projectionVersion: searchIndexGeneration.projectionVersion,
					settingsFingerprint: searchIndexGeneration.settingsFingerprint,
					lastVerifiedLsn: searchIndexGeneration.lastVerifiedLsn,
					failure: searchIndexGeneration.failure,
				});
		}
		if (!generation) throw new Error("Search generation declaration returned no row");

		try {
			if (!stableGeneration) {
				await setState(database, generation.id, "building", { failure: null });
				await ensureIndex(indexUid);
				await applySettings(kind, indexUid);
			}
			const watermark = await captureWatermark();
			if (!stableGeneration)
				await setState(database, generation.id, "catching_up", {
					sourceWatermarkLsn: watermark.lsn,
					sourceWatermarkAt: watermark.capturedAt,
				});
			const confirmedLsn = await waitForCatchUp(
				kind,
				indexUid,
				watermark.lsn,
				options.timeoutMs,
			);
			if (stableGeneration)
				await database
					.update(searchIndexGeneration)
					.set({ lastVerifiedLsn: confirmedLsn, verifiedAt: new Date(), failure: null })
					.where(eq(searchIndexGeneration.id, generation.id));
			else
				await setState(database, generation.id, "verified", {
					lastVerifiedLsn: confirmedLsn,
					verifiedAt: new Date(),
				});
			console.info(`Verified ${kind} search generation ${indexUid} at ${confirmedLsn}`);
		} catch (cause) {
			if (!stableGeneration) await markFailed(generation.id, cause);
			throw cause;
		}
	});
}

async function check(options: Options): Promise<void> {
	const kind = options.projection;
	const indexUid = options.indexUid ?? defaultIndexUid(kind);
	await withProjectionLock(kind, async () => {
		const generation = await findGeneration(kind, indexUid);
		if (!generation || generation.state !== "active")
			throw new ProjectionConfigurationError(
				`Search generation ${indexUid} is not active; run task local:setup or the explicit generation rollout`,
			);
		assertCompatibleGeneration(generation, kind, getSearchSettingsFingerprint(kind));
		if (!(await indexExists(indexUid)))
			throw new ProjectionConfigurationError(
				`Active Meilisearch index ${indexUid} is missing`,
			);
		if (!generation.lastVerifiedLsn)
			throw new ProjectionConfigurationError(
				`Active search generation ${indexUid} has no verified WAL watermark`,
			);
		await waitForCatchUp(kind, indexUid, generation.lastVerifiedLsn, options.timeoutMs);
		console.info(`Search generation ${indexUid} is active and healthy`);
	});
}

async function promote(options: Options): Promise<void> {
	if (!options.indexUid) throw new TypeError("promote requires --index UID");
	const indexUid = options.indexUid;
	await withProjectionLock(options.projection, async () => {
		await database.transaction(async (tx) => {
			const [target] = await tx
				.select({ id: searchIndexGeneration.id, state: searchIndexGeneration.state })
				.from(searchIndexGeneration)
				.where(
					and(
						eq(searchIndexGeneration.projectionKind, options.projection),
						eq(searchIndexGeneration.indexUid, indexUid),
					),
				)
				.limit(1);
			if (target?.state === "active") return;
			if (!target || target.state !== "verified")
				throw new ProjectionConfigurationError(
					"Only a verified generation can be promoted",
				);
			await tx
				.update(searchIndexGeneration)
				.set({ state: "verified" })
				.where(
					and(
						eq(searchIndexGeneration.projectionKind, options.projection),
						eq(searchIndexGeneration.state, "active"),
						ne(searchIndexGeneration.id, target.id),
					),
				);
			await tx
				.update(searchIndexGeneration)
				.set({ state: "active", activatedAt: new Date() })
				.where(eq(searchIndexGeneration.id, target.id));
		});
	});
	clearActiveSearchGenerationCache();
	console.info(`Promoted ${options.projection} search generation ${indexUid}`);
}

async function retire(options: Options): Promise<void> {
	if (!options.indexUid) throw new TypeError("retire requires --index UID");
	const indexUid = options.indexUid;
	await withProjectionLock(options.projection, async () => {
		const generation = await findGeneration(options.projection, indexUid);
		if (!generation)
			throw new ProjectionConfigurationError(`Search generation ${indexUid} does not exist`);
		if (generation.state !== "verified")
			throw new ProjectionConfigurationError(
				`Only a non-active verified generation can be retired; ${indexUid} is ${generation.state}`,
			);
		await database
			.update(searchIndexGeneration)
			.set({ state: "retired" })
			.where(
				and(
					eq(searchIndexGeneration.projectionKind, options.projection),
					eq(searchIndexGeneration.indexUid, indexUid),
					eq(searchIndexGeneration.state, "verified"),
				),
			);
	});
	clearActiveSearchGenerationCache();
	console.info(`Retired ${options.projection} search generation ${indexUid}`);
}

async function rebuildLocal(options: Options): Promise<void> {
	if (!options.confirmed)
		throw new ProjectionConfigurationError("rebuild-local requires --yes confirmation");
	if (!options.indexUid) throw new TypeError("rebuild-local requires --index UID");
	assertLocalLifecycleTargets({ databaseUrl, meilisearchUrl, sequinUrl });
	const kind = options.projection;
	const indexUid = options.indexUid;
	const fingerprint = getSearchSettingsFingerprint(kind);
	const sinkName = indexUid.replaceAll("_", "-");
	const sourceTable = sourceTableFor(kind);
	await withProjectionLock(kind, async () => {
		let generation = await findGeneration(kind, indexUid);
		if (generation) assertCompatibleGeneration(generation, kind, fingerprint);
		const sinks = await listSequinSinks();
		requireSequinSink(sinks, sinkName, sourceTable);
		const cancellations = new Map<string, string>();
		for (const sink of sinks)
			for (const backfill of sink.activeBackfills) {
				const normalizedTable = backfill.table?.includes(".")
					? backfill.table
					: backfill.table
						? `public.${backfill.table}`
						: undefined;
				const invalid = !normalizedTable || !sink.sourceTables.includes(normalizedTable);
				if (sink.name === sinkName || invalid)
					cancellations.set(`${sink.name}:${backfill.id}`, sink.name);
			}
		for (const [key, ownerSinkName] of cancellations) {
			const backfillId = key.slice(ownerSinkName.length + 1);
			await cancelBackfill(ownerSinkName, backfillId);
			console.info(`Cancelled stale Sequin backfill ${backfillId} on ${ownerSinkName}`);
		}

		await deleteIndex(indexUid);
		if (generation) {
			await setState(database, generation.id, "building", {
				sourceWatermarkLsn: null,
				sourceWatermarkAt: null,
				lastVerifiedLsn: null,
				verifiedAt: null,
				activatedAt: null,
				failure: null,
			});
		} else {
			[generation] = await database
				.insert(searchIndexGeneration)
				.values({
					projectionKind: kind,
					indexUid,
					projectionVersion: SearchProjectionVersions[kind],
					settingsFingerprint: fingerprint,
					sequinSinkName: sinkName,
					state: "building",
				})
				.returning({
					id: searchIndexGeneration.id,
					state: searchIndexGeneration.state,
					projectionVersion: searchIndexGeneration.projectionVersion,
					settingsFingerprint: searchIndexGeneration.settingsFingerprint,
					lastVerifiedLsn: searchIndexGeneration.lastVerifiedLsn,
					failure: searchIndexGeneration.failure,
				});
		}
		if (!generation) throw new Error("Search generation rebuild returned no row");
		try {
			await createIndex(indexUid);
			await applySettings(kind, indexUid);
			const backfillId = await createBackfill(sinkName, sourceTable);
			console.info(
				`Recreated local index ${indexUid}; Sequin backfill ${backfillId} is now active`,
			);
		} catch (cause) {
			await markFailed(generation.id, cause);
			throw cause;
		}
	});
}

try {
	const options = parseOptions(process.argv.slice(2));
	switch (options.action) {
		case "check":
			await check(options);
			break;
		case "prepare":
			await prepare(options);
			break;
		case "rebuild-local":
			await rebuildLocal(options);
			break;
		case "reconcile":
			await reconcile(options);
			break;
		case "promote":
			await promote(options);
			break;
		case "retire":
			await retire(options);
			break;
	}
} finally {
	await database.$client.end();
}
