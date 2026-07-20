import { and, eq, inArray, ne, sql } from "drizzle-orm";

import { env } from "../src/services/config";
import { database, type DatabaseTransaction } from "../src/services/database";
import {
	searchIndexGeneration,
	searchRevisionProjectionSource,
	searchUnitProjectionSource,
	type SearchIndexGenerationState,
} from "../src/services/database/schema";
import {
	parseCurrentSearchDocument,
	parseRevisionSearchDocument,
} from "../src/services/search/contracts";
import { clearActiveSearchGenerationCache } from "../src/services/search/generation";
import {
	getSearchSettingsFingerprint,
	SearchProjectionSettings,
	type SearchProjectionKind,
} from "../src/services/search/settings";

function requiredEnvironment(name: string, value: string | undefined): string {
	if (!value) throw new Error(`${name} is required by the search index lifecycle command`);
	return value;
}

const meilisearchUrl = requiredEnvironment("MEILISEARCH_URL", env.MEILISEARCH_URL);
const reconcilerKey = requiredEnvironment(
	"MEILISEARCH_RECONCILER_KEY",
	env.MEILISEARCH_RECONCILER_KEY,
);
const sequinUrl = requiredEnvironment("SEQUIN_URL", env.SEQUIN_URL);
const sequinApiToken = requiredEnvironment("SEQUIN_API_TOKEN", env.SEQUIN_API_TOKEN);

interface Options {
	readonly action: "prepare" | "reconcile" | "promote" | "retire";
	readonly projection: SearchProjectionKind;
	readonly indexUid?: string;
}

function parseOptions(arguments_: readonly string[]): Options {
	const [actionValue, ...flags] = arguments_;
	if (
		actionValue !== "prepare" &&
		actionValue !== "reconcile" &&
		actionValue !== "promote" &&
		actionValue !== "retire"
	)
		throw new TypeError(
			"Usage: search-index prepare|reconcile|promote|retire --projection current|history [--index UID]",
		);
	const option = (name: string) => {
		const index = flags.indexOf(name);
		return index < 0 ? undefined : flags[index + 1];
	};
	const projection = option("--projection");
	if (projection !== "current" && projection !== "history")
		throw new TypeError("--projection must be current or history");
	return { action: actionValue, projection, indexUid: option("--index") };
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

async function request(path: string, init: RequestInit = {}): Promise<unknown> {
	const response = await fetch(`${meilisearchUrl}${path}`, {
		...init,
		headers: {
			Authorization: `Bearer ${reconcilerKey}`,
			"Content-Type": "application/json",
			...init.headers,
		},
		signal: AbortSignal.timeout(30_000),
	});
	const body: unknown = await response.json().catch(() => undefined);
	if (!response.ok)
		throw new Error(
			`Meilisearch ${init.method ?? "GET"} ${path} failed with ${response.status}`,
		);
	return body;
}

async function waitForTask(taskUid: number): Promise<void> {
	for (let attempt = 0; attempt < 120; attempt += 1) {
		const task = await request(`/tasks/${taskUid}`);
		if (!isRecord(task) || typeof task.status !== "string")
			throw new TypeError("Invalid Meilisearch task response");
		if (task.status === "succeeded") return;
		if (task.status === "failed" || task.status === "canceled")
			throw new Error(
				`Meilisearch task ${taskUid} ${task.status}: ${JSON.stringify(task.error)}`,
			);
		await new Promise((resolve) => setTimeout(resolve, 250));
	}
	throw new Error(`Meilisearch task ${taskUid} timed out`);
}

async function taskRequest(path: string, init: RequestInit): Promise<void> {
	const body = await request(path, init);
	if (!isRecord(body) || typeof body.taskUid !== "number")
		throw new TypeError("Meilisearch mutation did not return a task UID");
	await waitForTask(body.taskUid);
}

function projectionVersion(kind: SearchProjectionKind): number {
	return kind === "current" ? 1 : 1;
}

function defaultIndexUid(kind: SearchProjectionKind): string {
	const prefix = kind === "current" ? "rezics_units" : "rezics_revisions";
	return `${prefix}_v${projectionVersion(kind)}_${new Date().toISOString().slice(0, 10).replaceAll("-", "")}`;
}

async function findGeneration(kind: SearchProjectionKind, indexUid: string) {
	const [generation] = await database
		.select({
			id: searchIndexGeneration.id,
			state: searchIndexGeneration.state,
			projectionVersion: searchIndexGeneration.projectionVersion,
			settingsFingerprint: searchIndexGeneration.settingsFingerprint,
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

function assertCompatibleGeneration(
	generation: NonNullable<Awaited<ReturnType<typeof findGeneration>>>,
	kind: SearchProjectionKind,
	fingerprint: string,
): void {
	if (
		generation.projectionVersion !== projectionVersion(kind) ||
		generation.settingsFingerprint !== fingerprint
	)
		throw new Error(
			"An existing generation cannot be mutated to a different contract or settings fingerprint; use a new versioned index UID",
		);
}

async function ensureIndex(indexUid: string): Promise<void> {
	const existing = await fetch(`${meilisearchUrl}/indexes/${indexUid}`, {
		headers: { Authorization: `Bearer ${reconcilerKey}` },
		signal: AbortSignal.timeout(5_000),
	});
	if (existing.status === 404) {
		await taskRequest("/indexes", {
			method: "POST",
			body: JSON.stringify({ uid: indexUid, primaryKey: "id" }),
		});
		return;
	}
	if (!existing.ok) throw new Error(`Unable to inspect Meilisearch index ${indexUid}`);
}

async function verifySequinSink(sinkName: string, sourceTable: string): Promise<void> {
	const response = await fetch(`${sequinUrl}/api/sinks`, {
		headers: { Authorization: `Bearer ${sequinApiToken}` },
		signal: AbortSignal.timeout(10_000),
	});
	if (!response.ok) throw new Error(`Sequin sink inspection failed with ${response.status}`);
	const body: unknown = await response.json();
	if (!isRecord(body) || !Array.isArray(body.data))
		throw new TypeError("Invalid Sequin sink response");
	const sink = body.data.find((value) => isRecord(value) && value.name === sinkName);
	if (!isRecord(sink)) throw new Error(`Sequin sink ${sinkName} is not applied`);
	if (sink.status !== "active") throw new Error(`Sequin sink ${sinkName} is not active`);
	if (Array.isArray(sink.active_backfills) && sink.active_backfills.length > 0)
		throw new Error(`Sequin sink ${sinkName} still has an active backfill`);
	if (sink.source !== undefined && !JSON.stringify(sink.source).includes(sourceTable))
		throw new Error(`Sequin sink ${sinkName} does not source ${sourceTable}`);
	const health = sink.health;
	if (!isRecord(health) || health.status !== "healthy")
		throw new Error(`Sequin sink ${sinkName} is not healthy`);
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

async function setState(
	tx: DatabaseTransaction,
	id: string,
	state: SearchIndexGenerationState,
	values: Partial<typeof searchIndexGeneration.$inferInsert> = {},
): Promise<void> {
	await tx
		.update(searchIndexGeneration)
		.set({ ...values, state })
		.where(eq(searchIndexGeneration.id, id));
}

async function verifyDocuments(kind: SearchProjectionKind, indexUid: string): Promise<void> {
	const stats = await request(`/indexes/${indexUid}/stats`);
	if (!isRecord(stats) || typeof stats.numberOfDocuments !== "number")
		throw new TypeError("Invalid Meilisearch index stats response");
	const countResult = await database.execute<{ count: string }>(
		kind === "current"
			? sql`select count(*)::text as count from search_unit_projection_source source join unit on unit.id = source.unit_id where unit.kind in ('book', 'software', 'media', 'profile', 'entity', 'tag', 'post', 'realm', 'collection', 'poll')`
			: sql`select count(*)::text as count from search_revision_projection_source source join unit_revision revision on revision.id = source.revision_id where not revision.suppressed`,
	);
	const expected = Number(countResult.rows[0]?.count ?? "0");
	if (stats.numberOfDocuments !== expected)
		throw new Error(
			`Index ${indexUid} has ${stats.numberOfDocuments} documents; PostgreSQL expects ${expected}`,
		);
	if (expected === 0) return;
	const documents = await request(`/indexes/${indexUid}/documents?limit=20`);
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
	for (const document of parsed)
		if (expectedRevisions.get(document.id) !== document.revision)
			throw new Error(`Index ${indexUid} has a stale sampled document ${document.id}`);
}

async function waitForProjectionCatchUp(
	kind: SearchProjectionKind,
	indexUid: string,
	sinkName: string,
	sourceTable: string,
	watermark: string,
): Promise<string> {
	let lastFailure: unknown;
	for (let attempt = 0; attempt < 600; attempt += 1) {
		try {
			await verifySequinSink(sinkName, sourceTable);
			const confirmedLsn = await confirmedSlotLsn(watermark);
			if (!confirmedLsn)
				throw new Error(`Sequin has not consumed the source watermark ${watermark}`);
			await verifyDocuments(kind, indexUid);
			return confirmedLsn;
		} catch (cause) {
			lastFailure = cause;
			await new Promise((resolve) => setTimeout(resolve, 1_000));
		}
	}
	throw new Error(
		`Projection ${indexUid} did not catch up: ${lastFailure instanceof Error ? lastFailure.message : "unknown failure"}`,
	);
}

async function reconcile(options: Options): Promise<void> {
	const kind = options.projection;
	const indexUid = options.indexUid ?? defaultIndexUid(kind);
	const sinkName = indexUid.replaceAll("_", "-");
	const fingerprint = getSearchSettingsFingerprint(kind);
	let generation = await findGeneration(kind, indexUid);
	if (generation) {
		assertCompatibleGeneration(generation, kind, fingerprint);
		if (generation.state === "active" || generation.state === "verified") {
			await verifySequinSink(
				sinkName,
				kind === "current"
					? "public.search_unit_projection_source"
					: "public.search_revision_projection_source",
			);
			await verifyDocuments(kind, indexUid);
			return;
		}
	} else {
		[generation] = await database
			.insert(searchIndexGeneration)
			.values({
				projectionKind: kind,
				indexUid,
				projectionVersion: projectionVersion(kind),
				settingsFingerprint: fingerprint,
				sequinSinkName: sinkName,
			})
			.returning({
				id: searchIndexGeneration.id,
				state: searchIndexGeneration.state,
				projectionVersion: searchIndexGeneration.projectionVersion,
				settingsFingerprint: searchIndexGeneration.settingsFingerprint,
			});
	}
	if (!generation) throw new Error("Search generation declaration returned no row");
	try {
		await database.transaction(async (tx) => {
			await tx.execute(
				sql`select pg_advisory_xact_lock(hashtextextended(${"search-index:" + kind}, 0))`,
			);
			await setState(tx, generation.id, "building", { failure: null });
			await ensureIndex(indexUid);
			await taskRequest(`/indexes/${indexUid}/settings`, {
				method: "PATCH",
				body: JSON.stringify(SearchProjectionSettings[kind]),
			});
			const [watermark] = await tx
				.execute<{ lsn: string; captured_at: Date }>(
					sql`select pg_current_wal_lsn()::text as lsn, clock_timestamp() as captured_at`,
				)
				.then((result) => result.rows);
			if (!watermark) throw new Error("Unable to capture search source WAL watermark");
			await setState(tx, generation.id, "catching_up", {
				sourceWatermarkLsn: watermark.lsn,
				sourceWatermarkAt: watermark.captured_at,
			});
			const sourceTable =
				kind === "current"
					? "public.search_unit_projection_source"
					: "public.search_revision_projection_source";
			const confirmedLsn = await waitForProjectionCatchUp(
				kind,
				indexUid,
				sinkName,
				sourceTable,
				watermark.lsn,
			);
			await setState(tx, generation.id, "verified", {
				lastVerifiedLsn: confirmedLsn,
				verifiedAt: new Date(),
			});
		});
	} catch (cause) {
		await database
			.update(searchIndexGeneration)
			.set({
				state: "failed",
				failure:
					cause instanceof Error
						? cause.message.slice(0, 2_000)
						: "Unknown reconciliation failure",
			})
			.where(eq(searchIndexGeneration.id, generation.id));
		throw cause;
	}
}

async function prepare(options: Options): Promise<void> {
	const kind = options.projection;
	const indexUid = options.indexUid ?? defaultIndexUid(kind);
	const fingerprint = getSearchSettingsFingerprint(kind);
	const existing = await findGeneration(kind, indexUid);
	if (existing) {
		assertCompatibleGeneration(existing, kind, fingerprint);
		await ensureIndex(indexUid);
		if (existing.state === "active" || existing.state === "verified") return;
	}
	await database
		.insert(searchIndexGeneration)
		.values({
			projectionKind: kind,
			indexUid,
			projectionVersion: projectionVersion(kind),
			settingsFingerprint: fingerprint,
			sequinSinkName: indexUid.replaceAll("_", "-"),
			state: "building",
		})
		.onConflictDoUpdate({
			target: searchIndexGeneration.indexUid,
			set: { state: "building", failure: null },
		});
	await ensureIndex(indexUid);
	await taskRequest(`/indexes/${indexUid}/settings`, {
		method: "PATCH",
		body: JSON.stringify(SearchProjectionSettings[kind]),
	});
}

async function promote(options: Options): Promise<void> {
	if (!options.indexUid) throw new TypeError("promote requires --index UID");
	const indexUid = options.indexUid;
	await database.transaction(async (tx) => {
		await tx.execute(
			sql`select pg_advisory_xact_lock(hashtextextended(${"search-index:" + options.projection}, 0))`,
		);
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
			throw new Error("Only a verified generation can be promoted");
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
	clearActiveSearchGenerationCache();
}

async function retire(options: Options): Promise<void> {
	if (!options.indexUid) throw new TypeError("retire requires --index UID");
	await database
		.update(searchIndexGeneration)
		.set({ state: "retired" })
		.where(
			and(
				eq(searchIndexGeneration.projectionKind, options.projection),
				eq(searchIndexGeneration.indexUid, options.indexUid),
				eq(searchIndexGeneration.state, "verified"),
			),
		);
	clearActiveSearchGenerationCache();
}

const options = parseOptions(process.argv.slice(2));
if (options.action === "prepare") await prepare(options);
else if (options.action === "reconcile") await reconcile(options);
else if (options.action === "promote") await promote(options);
else await retire(options);
