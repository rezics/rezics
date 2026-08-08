import { Client, type QueryResult } from "pg";

type SearchPlan = readonly [
	{
		readonly "Execution Time": number;
		readonly "Planning Time": number;
		readonly Plan: Record<string, unknown>;
	},
];

type PlanSummary = Readonly<{
	indexNames: readonly string[];
	nodeTypes: readonly string[];
	sharedHitBlocks: number;
	sharedReadBlocks: number;
	sharedWrittenBlocks: number;
}>;

type SearchWorkload = Readonly<{
	name: string;
	query: string;
}>;

type LatencySummary = Readonly<{
	completed: number;
	maxMilliseconds: number;
	p50Milliseconds: number;
	p95Milliseconds: number;
	p99Milliseconds: number;
	timedOut: number;
	warmupMilliseconds: number;
}>;

type PgroongaWalRow = Readonly<{
	bytes: string;
	fullPageImageBytes: string;
	recordBytes: string;
	records: string;
}>;

const searchWorkloads: readonly SearchWorkload[] = [
	{
		name: "metadata-distinctive",
		query: "capacityneedle1000000",
	},
	{
		name: "metadata-cjk",
		query: "銀河",
	},
	{
		name: "metadata-common",
		query: "Library",
	},
	{
		name: "body-distinctive",
		query: "bodyneedle1000000",
	},
	{
		name: "body-common",
		query: "Chapter",
	},
] as const;

function summarizePlan(plan: Record<string, unknown>): PlanSummary {
	const indexNames = new Set<string>();
	const nodeTypes = new Set<string>();
	const visit = (node: Record<string, unknown>): void => {
		const nodeType = node["Node Type"];
		if (typeof nodeType === "string") nodeTypes.add(nodeType);
		const indexName = node["Index Name"];
		if (typeof indexName === "string") indexNames.add(indexName);
		const children = node.Plans;
		if (!Array.isArray(children)) return;
		for (const child of children) {
			if (typeof child === "object" && child !== null)
				visit(child as Record<string, unknown>);
		}
	};
	visit(plan);
	return {
		indexNames: [...indexNames].sort(),
		nodeTypes: [...nodeTypes].sort(),
		// EXPLAIN's root counters already include child work; summing the tree
		// double-counts the same shared blocks at every ancestor.
		sharedHitBlocks:
			typeof plan["Shared Hit Blocks"] === "number" ? plan["Shared Hit Blocks"] : 0,
		sharedReadBlocks:
			typeof plan["Shared Read Blocks"] === "number" ? plan["Shared Read Blocks"] : 0,
		sharedWrittenBlocks:
			typeof plan["Shared Written Blocks"] === "number" ? plan["Shared Written Blocks"] : 0,
	};
}

function readPositiveIntegerFlag(name: string, fallback: number, maximum: number): number {
	const position = process.argv.indexOf(name);
	if (position < 0) return fallback;
	const value = Number(process.argv[position + 1]);
	if (!Number.isSafeInteger(value) || value < 1 || value > maximum)
		throw new RangeError(`${name} must be an integer between 1 and ${maximum}`);
	return value;
}

function readLsnFlag(name: string): string | undefined {
	const position = process.argv.indexOf(name);
	if (position < 0) return undefined;
	const value = process.argv[position + 1];
	if (!value || !/^[0-9A-F]+\/[0-9A-F]+$/i.test(value))
		throw new RangeError(`${name} must be a PostgreSQL LSN`);
	return value;
}

function percentile(sorted: readonly number[], percentage: number): number {
	const index = Math.max(0, Math.ceil(sorted.length * percentage) - 1);
	return Number((sorted[index] ?? 0).toFixed(3));
}

function hasPostgresErrorCode(error: unknown, code: string): boolean {
	return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

function summarizeLatencies(
	latencies: readonly number[],
	timedOut: number,
	warmupMilliseconds: number,
): LatencySummary {
	const sorted = [...latencies].sort((left, right) => left - right);
	return {
		completed: sorted.length,
		maxMilliseconds: Number((sorted.at(-1) ?? 0).toFixed(3)),
		p50Milliseconds: percentile(sorted, 0.5),
		p95Milliseconds: percentile(sorted, 0.95),
		p99Milliseconds: percentile(sorted, 0.99),
		timedOut,
		warmupMilliseconds,
	};
}

function searchSql(cursor = false): string {
	return `with ordered_source as materialized (
			select text_candidate.unit_id,
				(text_candidate.unit_updated_at_micros::numeric / 1000000) as primary_order,
				0::numeric as secondary_order,
				text_candidate.search_matched
			from public.search_text_candidates(
				$1, array[]::text[], 'book',
				${cursor ? "$2::bigint, $3::uuid" : "null, null"},
				50000,
				65
			) text_candidate
			order by text_candidate.unit_updated_at_micros desc,
				text_candidate.unit_id desc
		), scanned_candidates as materialized (
			select * from ordered_source
			order by primary_order desc, secondary_order desc, unit_id desc
			limit 64
		), search_matches as materialized (
			select scanned.unit_id
			from scanned_candidates scanned
			where scanned.search_matched
			union all
			select scanned.unit_id
			from scanned_candidates scanned
			where not scanned.search_matched
			  and exists (
				select 1 from public.unit_search_document document
				where document.unit_id = scanned.unit_id
				  and document.text_all &@~ public.pgroonga_query_escape($1)
			  )
		), eligible_matches as (
			select candidate.id as unit_id, scanned.primary_order, scanned.secondary_order
			from scanned_candidates scanned
			inner join search_matches matched on matched.unit_id = scanned.unit_id
			inner join public.unit candidate on candidate.id = scanned.unit_id
			where candidate.status = 'published'
			  and candidate.visibility = 'public'
			  and candidate.moderation_status = 'approved'
			  and candidate.deleted_at is null
			  and candidate.kind = any(array['book', 'media', 'software', 'zone', 'realm', 'collection', 'poll']::text[])
			  and not exists (
				select 1 from public.unit_variant relationship
				where relationship.variant_unit_id = candidate.id
			  )
		), accepted as materialized (
			select * from eligible_matches
			order by primary_order desc, secondary_order desc, unit_id desc
			limit 21
		)
		select unit_id
		from accepted
		order by primary_order desc, secondary_order desc, unit_id desc
		limit 20`;
}

function updatedAtOrderedSql(cursor: boolean): string {
	return `select candidate.id as unit_id
		from public.unit candidate
		where candidate.status = 'published'
		  and candidate.visibility = 'public'
		  and candidate.moderation_status = 'approved'
		  and candidate.deleted_at is null
		  ${cursor ? "and (candidate.updated_at, candidate.id) < ($1::timestamptz, $2::uuid)" : ""}
		order by candidate.updated_at desc, candidate.id desc
		limit 20`;
}

function tagSeedProbeSql(): string {
	return `select relation.unit_id
		from public.unit_effective_tag relation
		where relation.tag_id = $1::uuid
		limit 4097`;
}

function tagOrderedUpdatedAtSql(cursor: boolean): string {
	return `select candidate.id as unit_id
		from public.unit candidate
		where candidate.status = 'published'
		  and candidate.visibility = 'public'
		  and candidate.moderation_status = 'approved'
		  and candidate.deleted_at is null
		  and exists (
			select 1
			from public.unit_effective_tag relation
			where relation.tag_id = $1::uuid
			  and relation.unit_id = candidate.id
		  )
		  ${cursor ? "and (candidate.updated_at, candidate.id) < ($2::timestamptz, $3::uuid)" : ""}
		order by candidate.updated_at desc, candidate.id desc
		limit 20`;
}

function bestPositiveSql(cursor: boolean, limit = 20): string {
	return `select score.unit_id
		from public.unit_best_score score
		where score.snapshot_id = $1::uuid
		  and score.unit_kind = 'book'
		  ${
				cursor
					? `and (score.score, score.unit_updated_at, score.unit_id)
					< ($2::double precision, $3::timestamptz, $4::uuid)`
					: ""
}
		order by score.score desc, score.unit_updated_at desc, score.unit_id desc
		limit ${limit}`;
}

function bestZeroSql(cursor: boolean, limit = 20): string {
	return `select candidate.id as unit_id
		from public.unit candidate
		where candidate.status = 'published'
		  and candidate.kind = 'book'
		  and candidate.visibility = 'public'
		  and candidate.moderation_status = 'approved'
		  and candidate.deleted_at is null
		  and not exists (
			select 1 from public.unit_best_score positive
			where positive.snapshot_id = $1::uuid and positive.unit_id = candidate.id
		  )
		  ${cursor ? "and (candidate.updated_at, candidate.id) < ($2::timestamptz, $3::uuid)" : ""}
		order by candidate.updated_at desc, candidate.id desc
		limit ${limit}`;
}

function bestPipelineSql(source: string): string {
	return `with ordered_source as materialized (
			${source}
		), scanned_candidates as materialized (
			select * from ordered_source limit 64
		), eligible_matches as (
			select candidate.id
			from scanned_candidates scanned
			inner join public.unit candidate on candidate.id = scanned.unit_id
			where candidate.status = 'published'
			  and candidate.visibility = 'public'
			  and candidate.moderation_status = 'approved'
			  and candidate.deleted_at is null
			  and candidate.kind = any(array['book', 'media', 'software', 'zone', 'realm', 'collection', 'poll']::text[])
			  and not exists (
				select 1 from public.unit_variant relationship
				where relationship.variant_unit_id = candidate.id
			  )
		)
		select id from eligible_matches limit 20`;
}

function requireOrderingIndex(name: string, plan: SearchPlan, indexName: string): void {
	const summary = summarizePlan(plan[0].Plan);
	if (!summary.indexNames.includes(indexName))
		throw new Error(`${name} did not use required ordering index ${indexName}`);
}

function requireBoundedPlan(name: string, plan: SearchPlan, maximumBlocks: number): void {
	const summary = summarizePlan(plan[0].Plan);
	const touchedBlocks = summary.sharedHitBlocks + summary.sharedReadBlocks;
	if (touchedBlocks > maximumBlocks)
		throw new Error(
			`${name} touched ${touchedBlocks} shared blocks; expected at most ${maximumBlocks}`,
		);
}

async function runConcurrencyTier(
	connectionString: string,
	concurrency: number,
	sampleCount: number,
): Promise<LatencySummary> {
	const clients = Array.from({ length: concurrency }, () => new Client({ connectionString }));
	await Promise.all(clients.map((worker) => worker.connect()));
	let nextSample = 0;
	let timedOut = 0;
	const latencies: number[] = [];
	try {
		await Promise.all(
			clients.map((worker) => worker.query("set statement_timeout = '1500ms'")),
		);
		const warmupStartedAt = performance.now();
		const warmup = searchWorkloads[0];
		if (!warmup) throw new Error("Search warm-up workload is unavailable");
		await Promise.all(clients.map((worker) => worker.query(searchSql(), [warmup.query])));
		const warmupMilliseconds = Number((performance.now() - warmupStartedAt).toFixed(3));
		await Promise.all(
			clients.map(async (worker) => {
				while (nextSample < sampleCount) {
					const sample = nextSample;
					nextSample += 1;
					const workload = searchWorkloads[sample % searchWorkloads.length];
					if (!workload) throw new Error("Search workload selection failed");
					const startedAt = performance.now();
					try {
						await worker.query(searchSql(), [workload.query]);
						latencies.push(performance.now() - startedAt);
					} catch (error) {
						if (hasPostgresErrorCode(error, "57014")) {
							timedOut += 1;
							continue;
						}
						throw error;
					}
				}
			}),
		);
		return summarizeLatencies(latencies, timedOut, warmupMilliseconds);
	} finally {
		await Promise.all(clients.map((worker) => worker.end()));
	}
}

async function verifyCancellationRecovery(client: Client): Promise<boolean> {
	await client.query("begin");
	try {
		await client.query("set local statement_timeout = '10ms'");
		await client.query("select pg_sleep(0.05)");
		throw new Error("Cancellation probe unexpectedly completed");
	} catch (error) {
		if (!hasPostgresErrorCode(error, "57014")) throw error;
		await client.query("rollback");
	}
	const recovery = await client.query<{ readonly recovered: number }>(
		"select 1::integer as recovered",
	);
	return recovery.rows[0]?.recovered === 1;
}

if (!process.argv.includes("--yes"))
	throw new Error("Search capacity fixture creation requires explicit --yes confirmation");
if (process.env.SEARCH_CAPACITY_DISPOSABLE !== "search-capacity-v1")
	throw new Error(
		"SEARCH_CAPACITY_DISPOSABLE=search-capacity-v1 is required for destructive capacity work",
	);
const rowCount = readPositiveIntegerFlag("--rows", 1_000_000, 1_000_000);
if (rowCount < 1_000)
	throw new RangeError(
		"--rows must be at least 1000 to exercise sparse best-score and Tag candidate phases",
	);
const sampleCount = readPositiveIntegerFlag("--samples", 128, 4_096);
const reuseFixture = process.argv.includes("--reuse");
const rebuildIndexes = process.argv.includes("--reindex");
const retainedWalStart = readLsnFlag("--wal-start-lsn");
const connectionString = process.env.DATABASE_ADMIN_URL;
if (!connectionString) throw new Error("DATABASE_ADMIN_URL is required");
const databaseName = new URL(connectionString).pathname.slice(1);
if (databaseName !== "rezics_atlas")
	throw new Error("Search capacity benchmarks may run only against disposable rezics_atlas");

const client = new Client({ connectionString });
await client.connect();
try {
	await client.query("set statement_timeout = 0");
	await client.query("create extension if not exists pg_walinspect");
	const walBefore = await client.query<{ readonly lsn: string }>(
		"select pg_current_wal_lsn()::text as lsn",
	);
	let loadMilliseconds: number | null = null;
	let capacitySnapshotId: string;
	if (reuseFixture) {
		const fixture = await client.query<{ readonly rowCount: string }>(`
			select count(*)::text as "rowCount"
			from public.search_capacity_fixture_v1
		`);
		if (Number(fixture.rows[0]?.rowCount) !== rowCount)
			throw new Error("Existing search capacity fixture row count does not match --rows");
		const snapshot = await client.query<{ readonly id: string }>(`
			select id from public.recommendation_snapshot
			where policy_version = 'search-capacity-v1' and active
			limit 1
		`);
		const id = snapshot.rows[0]?.id;
		if (!id)
			throw new Error("Existing search capacity fixture has no active Search score snapshot");
		capacitySnapshotId = id;
	} else {
		const loadStartedAt = performance.now();
		await client.query("begin");
		await client.query("set local synchronous_commit = off");
		await client.query(`
			create unlogged table public.search_capacity_fixture_v1 (
				ordinal integer primary key,
				unit_id uuid unique not null
			)
		`);
		await client.query(
			`insert into public.search_capacity_fixture_v1 (ordinal, unit_id)
			 select ordinal, md5('rezics-search-capacity-v1:' || ordinal)::uuid
			 from generate_series(1, $1::integer) ordinal`,
			[rowCount],
		);
		await client.query(
			"alter table public.unit disable trigger unit_search_document_from_unit",
		);
		await client.query(
			"alter table public.unit_localization disable trigger unit_search_document_from_localization",
		);
		await client.query(`
			insert into public.unit (id, kind, status, visibility, published_at)
			select unit_id,
				case when ordinal between 2 and 101 then 'tag' else 'book' end,
				'published', 'public', now()
			from public.search_capacity_fixture_v1
		`);
		await client.query(`
			insert into public.tag (id)
			select unit_id
			from public.search_capacity_fixture_v1
			where ordinal between 2 and 101
		`);
		await client.query(`
			insert into public.unit_effective_tag (
				unit_id, tag_id, direct, structure_support_count
			)
			select candidate.unit_id, tag.unit_id, true, 0
			from public.search_capacity_fixture_v1 candidate
			cross join public.search_capacity_fixture_v1 tag
			where candidate.ordinal > 101
			  and tag.ordinal = 2 + (candidate.ordinal % 100)
		`);
		await client.query(`
			insert into public.unit_search_document (
				unit_id, unit_kind, unit_updated_at_micros,
				search_order_key, text_all,
				text_zh, text_en, text_ja
			)
			select fixture.unit_id, candidate.kind,
				(extract(epoch from candidate.updated_at) * 1000000)::bigint,
				lpad(((extract(epoch from candidate.updated_at) * 1000000)::bigint)::text, 20, '0')
					|| ':' || fixture.unit_id::text,
				search_text.document,
				case when fixture.ordinal % 3 = 0 then search_text.document end,
				case when fixture.ordinal % 3 = 2 then search_text.document end,
				case when fixture.ordinal % 3 = 1 then search_text.document end
			from public.search_capacity_fixture_v1 fixture
			join public.unit candidate on candidate.id = fixture.unit_id
			cross join lateral (
				select (
					case when fixture.ordinal % 10000 = 0
						then '銀河 capacityneedle' || fixture.ordinal::text || E'\nBounded capacity fixture ' || fixture.ordinal::text || E'\n'
						else 'Library catalog item ' || fixture.ordinal::text || E'\nBounded capacity fixture ' || fixture.ordinal::text || E'\n'
					end
					|| case when fixture.ordinal % 10000 = 0
						then 'bodyneedle' || fixture.ordinal::text
						else 'Chapter body ' || fixture.ordinal::text
					end
				) as document
			) search_text
		`);
		await client.query("alter table public.unit enable trigger unit_search_document_from_unit");
		await client.query(
			"alter table public.unit_localization enable trigger unit_search_document_from_localization",
		);
		await client.query(`
			insert into public.unit_localization (
				unit_id, language, title, summary, content, content_status, position
			)
			select unit_id,
				case ordinal % 3 when 0 then 'zh' when 1 then 'ja' else 'en' end,
				case when ordinal % 10000 = 0
					then '銀河 capacityneedle' || ordinal::text
					else 'Library catalog item ' || ordinal::text end,
				'Bounded capacity fixture ' || ordinal::text,
				jsonb_build_object(
					'_type', 'portable-text',
					'content', jsonb_build_array(jsonb_build_object(
						'_type', 'block',
						'children', jsonb_build_array(jsonb_build_object(
							'_type', 'span',
							'text', case when ordinal % 10000 = 0
								then 'bodyneedle' || ordinal::text
								else 'Chapter body ' || ordinal::text end
						))
					))
				),
				'published',
				'a0'
			from public.search_capacity_fixture_v1
		`);
		const snapshot = await client.query<{ readonly id: string }>(`
			insert into public.recommendation_snapshot (
				policy_version, state, active, source_watermark, completed_at
			)
			values ('search-capacity-v1', 'ready', true, now(), now())
			returning id
		`);
		const id = snapshot.rows[0]?.id;
		if (!id) throw new Error("Search capacity snapshot insertion returned no row");
		capacitySnapshotId = id;
		await client.query(
			`insert into public.unit_best_score (
				snapshot_id, unit_id, unit_kind, score, unit_updated_at
			)
			select $1::uuid, fixture.unit_id, candidate.kind,
				($2::integer - fixture.ordinal + 1)::double precision,
				candidate.updated_at
			from public.search_capacity_fixture_v1 fixture
			join public.unit candidate on candidate.id = fixture.unit_id
			where fixture.ordinal % 100 = 0`,
			[capacitySnapshotId, rowCount],
		);
		await client.query("commit");
		await client.query("analyze public.unit");
		await client.query("analyze public.unit_localization");
		await client.query("analyze public.unit_search_document");
		await client.query("analyze public.unit_best_score");
		await client.query("analyze public.unit_effective_tag");
		loadMilliseconds = Math.round(performance.now() - loadStartedAt);
	}
	const tagFixture = await client.query<{
		readonly candidateCount: string;
		readonly tagId: string;
	}>(`
		select tag.unit_id::text as "tagId", count(relation.unit_id)::text as "candidateCount"
		from public.search_capacity_fixture_v1 tag
		left join public.unit_effective_tag relation on relation.tag_id = tag.unit_id
		where tag.ordinal = 2
		group by tag.unit_id
	`);
	const capacityTagId = tagFixture.rows[0]?.tagId;
	const tagCandidateCount = Number(tagFixture.rows[0]?.candidateCount ?? "0");
	if (!capacityTagId || tagCandidateCount < 1)
		throw new Error("Existing Search capacity fixture has no sparse Tag candidate relation");
	const walAfter = await client.query<{ readonly lsn: string }>(
		"select pg_current_wal_lsn()::text as lsn",
	);
	const loadWal = await client.query<{ readonly bytes: string }>(
		"select pg_wal_lsn_diff($1::pg_lsn, $2::pg_lsn)::text as bytes",
		[walAfter.rows[0]?.lsn, walBefore.rows[0]?.lsn],
	);
	const rebuildMilliseconds: Record<string, number> = {};
	if (rebuildIndexes) {
		for (const indexName of [
			"unit_localization_pgroonga_metadata_idx",
			"unit_localization_pgroonga_content_idx",
			"unit_search_document_pgroonga_idx",
		] as const) {
			const rebuildStartedAt = performance.now();
			await client.query(`reindex index public.${indexName}`);
			rebuildMilliseconds[indexName] = Math.round(performance.now() - rebuildStartedAt);
		}
	}
	const qualificationWalAfter = await client.query<{ readonly lsn: string }>(
		"select pg_current_wal_lsn()::text as lsn",
	);
	const walAnalysisStart = retainedWalStart ?? walBefore.rows[0]?.lsn;
	const qualificationWal = await client.query<{ readonly bytes: string }>(
		"select pg_wal_lsn_diff($1::pg_lsn, $2::pg_lsn)::text as bytes",
		[qualificationWalAfter.rows[0]?.lsn, walAnalysisStart],
	);
	const explain = async (
		query: string,
		cursor?: { readonly id: string; readonly updatedAtMicros: string },
	): Promise<SearchPlan> => {
		const result = await client.query<{ readonly "QUERY PLAN": SearchPlan }>(
			`explain (analyze, buffers, wal, format json) ${searchSql(Boolean(cursor))}`,
			cursor ? [query, cursor.updatedAtMicros, cursor.id] : [query],
		);
		const plan = result.rows[0]?.["QUERY PLAN"];
		if (!plan) throw new Error("PostgreSQL returned no benchmark plan");
		return plan;
	};
	const metadataPlan = await explain("capacityneedle1000000");
	const bodyPlan = await explain("bodyneedle1000000");
	const textCursor = await client.query<{
		readonly id: string;
		readonly updatedAtMicros: string;
	}>(
		`select document.unit_id::text as id,
			document.unit_updated_at_micros::text as "updatedAtMicros"
		 from public.unit_search_document document
		 where document.text_all like 'Library%'
		 order by document.unit_updated_at_micros desc, document.unit_id desc
		 offset $1::integer limit 1`,
		[Math.floor((rowCount - Math.floor(rowCount / 10000)) / 2)],
	);
	const deepTextPosition = textCursor.rows[0];
	if (!deepTextPosition) throw new Error("Search capacity fixture produced no deep text cursor");
	const textCommonFirstPlan = await explain("Library");
	const textCommonDeepPlan = await explain("Library", deepTextPosition);
	const deepCursor = await client.query<{
		readonly id: string;
		readonly updatedAt: string;
	}>(
		`select candidate.id, candidate.updated_at::text as "updatedAt"
		 from public.unit candidate
		 where candidate.status = 'published'
		   and candidate.visibility = 'public'
		   and candidate.moderation_status = 'approved'
		   and candidate.deleted_at is null
		 order by candidate.updated_at desc, candidate.id desc
		 offset $1::integer limit 1`,
		[Math.floor(rowCount / 2)],
	);
	const deepPosition = deepCursor.rows[0];
	if (!deepPosition) throw new Error("Search capacity fixture produced no deep cursor");
	const explainOrdered = async (cursor?: typeof deepPosition): Promise<SearchPlan> => {
		const result = await client.query<{ readonly "QUERY PLAN": SearchPlan }>(
			`explain (analyze, buffers, wal, format json) ${updatedAtOrderedSql(Boolean(cursor))}`,
			cursor ? [cursor.updatedAt, cursor.id] : [],
		);
		const plan = result.rows[0]?.["QUERY PLAN"];
		if (!plan) throw new Error("PostgreSQL returned no ordered benchmark plan");
		return plan;
	};
	const updatedAtFirstPlan = await explainOrdered();
	const updatedAtDeepPlan = await explainOrdered(deepPosition);
	requireOrderingIndex(
		"updated-at first page",
		updatedAtFirstPlan,
		"unit_public_updated_at_desc_idx",
	);
	requireBoundedPlan("updated-at deep cursor", updatedAtDeepPlan, 512);
	const tagDeepCursor = await client.query<{
		readonly id: string;
		readonly updatedAt: string;
	}>(
		`select candidate.id, candidate.updated_at::text as "updatedAt"
		 from public.unit_effective_tag relation
		 join public.unit candidate on candidate.id = relation.unit_id
		 where relation.tag_id = $1::uuid
		 order by candidate.updated_at desc, candidate.id desc
		 offset $2::integer limit 1`,
		[capacityTagId, Math.floor(tagCandidateCount / 2)],
	);
	const tagDeepPosition = tagDeepCursor.rows[0];
	if (!tagDeepPosition) throw new Error("Search capacity fixture produced no deep Tag cursor");
	const tagSeedProbeResult = await client.query<{ readonly "QUERY PLAN": SearchPlan }>(
		`explain (analyze, buffers, wal, format json) ${tagSeedProbeSql()}`,
		[capacityTagId],
	);
	const tagSeedProbePlan = tagSeedProbeResult.rows[0]?.["QUERY PLAN"];
	if (!tagSeedProbePlan) throw new Error("PostgreSQL returned no Tag seed-probe plan");
	const explainTagOrdered = async (cursor?: typeof tagDeepPosition): Promise<SearchPlan> => {
		const result = await client.query<{ readonly "QUERY PLAN": SearchPlan }>(
			`explain (analyze, buffers, wal, format json) ${tagOrderedUpdatedAtSql(
				Boolean(cursor),
			)}`,
			cursor ? [capacityTagId, cursor.updatedAt, cursor.id] : [capacityTagId],
		);
		const plan = result.rows[0]?.["QUERY PLAN"];
		if (!plan) throw new Error("PostgreSQL returned no Tag ordered-scan benchmark plan");
		return plan;
	};
	const tagOrderedFirstPlan = await explainTagOrdered();
	const tagOrderedDeepPlan = await explainTagOrdered(tagDeepPosition);
	requireOrderingIndex("Tag seed probe", tagSeedProbePlan, "unit_effective_tag_tag_idx");
	requireOrderingIndex(
		"Tag ordered first page",
		tagOrderedFirstPlan,
		"unit_public_updated_at_desc_idx",
	);
	requireOrderingIndex(
		"Tag ordered deep cursor",
		tagOrderedDeepPlan,
		"unit_public_updated_at_desc_idx",
	);
	const positiveCount = Math.floor(rowCount / 100);
	const positiveCursor = await client.query<{
		readonly id: string;
		readonly score: number;
		readonly updatedAt: string;
	}>(
		`select unit_id as id, score, unit_updated_at::text as "updatedAt"
		 from public.unit_best_score
		 where snapshot_id = $1::uuid and unit_kind = 'book'
		 order by score desc, unit_updated_at desc, unit_id desc
		 offset $2::integer limit 1`,
		[capacitySnapshotId, Math.floor(positiveCount / 2)],
	);
	const positivePosition = positiveCursor.rows[0];
	if (!positivePosition)
		throw new Error("Search capacity fixture produced no positive best cursor");
	const zeroCursor = await client.query<{
		readonly id: string;
		readonly updatedAt: string;
	}>(
		`select candidate.id, candidate.updated_at::text as "updatedAt"
		 from public.unit candidate
		 where candidate.status = 'published'
		   and candidate.kind = 'book'
		   and candidate.visibility = 'public'
		   and candidate.moderation_status = 'approved'
		   and candidate.deleted_at is null
		   and not exists (
			 select 1 from public.unit_best_score positive
			 where positive.snapshot_id = $1::uuid and positive.unit_id = candidate.id
		   )
		 order by candidate.updated_at desc, candidate.id desc
		 offset $2::integer limit 1`,
		[capacitySnapshotId, Math.floor((rowCount - positiveCount) / 2)],
	);
	const zeroPosition = zeroCursor.rows[0];
	if (!zeroPosition)
		throw new Error("Search capacity fixture produced no zero-score best cursor");
	const explainBestPositive = async (cursor?: typeof positivePosition): Promise<SearchPlan> => {
		const result = await client.query<{ readonly "QUERY PLAN": SearchPlan }>(
			`explain (analyze, buffers, wal, format json) ${bestPipelineSql(
				bestPositiveSql(Boolean(cursor), 65),
			)}`,
			cursor
				? [capacitySnapshotId, cursor.score, cursor.updatedAt, cursor.id]
				: [capacitySnapshotId],
		);
		const plan = result.rows[0]?.["QUERY PLAN"];
		if (!plan) throw new Error("PostgreSQL returned no best-positive benchmark plan");
		return plan;
	};
	const explainBestZero = async (cursor?: typeof zeroPosition): Promise<SearchPlan> => {
		const result = await client.query<{ readonly "QUERY PLAN": SearchPlan }>(
			`explain (analyze, buffers, wal, format json) ${bestPipelineSql(
				bestZeroSql(Boolean(cursor), 65),
			)}`,
			cursor ? [capacitySnapshotId, cursor.updatedAt, cursor.id] : [capacitySnapshotId],
		);
		const plan = result.rows[0]?.["QUERY PLAN"];
		if (!plan) throw new Error("PostgreSQL returned no best-zero benchmark plan");
		return plan;
	};
	const bestPositiveFirstPlan = await explainBestPositive();
	const bestPositiveDeepPlan = await explainBestPositive(positivePosition);
	const bestZeroFirstPlan = await explainBestZero();
	const bestZeroDeepPlan = await explainBestZero(zeroPosition);
	if (rowCount === 1_000_000) {
		for (const [name, plan] of [
			["best positive first page", bestPositiveFirstPlan],
			["best positive deep cursor", bestPositiveDeepPlan],
		] as const)
			requireOrderingIndex(name, plan, "unit_best_score_kind_order_idx");
		for (const [name, plan] of [
			["best zero first page", bestZeroFirstPlan],
			["best zero deep cursor", bestZeroDeepPlan],
		] as const)
			requireOrderingIndex(name, plan, "unit_public_kind_updated_at_desc_idx");
		requireBoundedPlan("best positive deep cursor", bestPositiveDeepPlan, 512);
		requireBoundedPlan("best zero deep cursor", bestZeroDeepPlan, 512);
	}
	requireOrderingIndex(
		"updated-at deep cursor",
		updatedAtDeepPlan,
		"unit_public_updated_at_desc_idx",
	);
	const sizeResult = await client.query<{
		readonly contentBytes: string;
		readonly metadataBytes: string;
		readonly searchDocumentIndexBytes: string;
		readonly searchDocumentTableBytes: string;
		readonly tableBytes: string;
	}>(`
		with index_sizes(index_name, bytes) as (
			select index_name,
				((inspection #>> '{1,disk_usage}')::bigint
				 + (inspection #>> '{1,table,disk_usage}')::bigint
				 + (inspection #>> '{1,sources,0,table,disk_usage}')::bigint) as bytes
			from (values
				('unit_localization_pgroonga_metadata_idx'),
				('unit_localization_pgroonga_content_idx'),
				('unit_search_document_pgroonga_idx')
			) indexes(index_name)
			cross join lateral (
				select pgroonga_command(
					'object_inspect',
					array['name', pgroonga_index_column_name(index_name::cstring, 0)]
				)::jsonb as inspection
			) inspected
		)
		select
			pg_relation_size('public.unit_localization')::text as "tableBytes",
			pg_relation_size('public.unit_search_document')::text as "searchDocumentTableBytes",
			(select bytes::text from index_sizes
			 where index_name = 'unit_localization_pgroonga_metadata_idx') as "metadataBytes",
			(select bytes::text from index_sizes
			 where index_name = 'unit_localization_pgroonga_content_idx') as "contentBytes",
			(select bytes::text from index_sizes
			 where index_name = 'unit_search_document_pgroonga_idx') as "searchDocumentIndexBytes"
	`);
	const sizes = sizeResult.rows[0];
	if (!sizes) throw new Error("PostgreSQL returned no capacity sizes");
	const runtime = await client.query<{
		readonly databaseBytes: string;
		readonly serverVersion: string;
		readonly sharedBuffers: string;
		readonly workMem: string;
	}>(`
		select
			pg_database_size(current_database())::text as "databaseBytes",
			current_setting('server_version') as "serverVersion",
			current_setting('shared_buffers') as "sharedBuffers",
			current_setting('work_mem') as "workMem"
	`);
	const databaseStats = await client.query<{
		readonly activeMilliseconds: number;
		readonly blocksHit: string;
		readonly blocksRead: string;
		readonly readMilliseconds: number;
		readonly sessionMilliseconds: number;
		readonly temporaryBytes: string;
		readonly tuplesInserted: string;
		readonly tuplesRead: string;
		readonly writeMilliseconds: number;
	}>(`
		select
			active_time::real as "activeMilliseconds",
			blks_hit::text as "blocksHit",
			blks_read::text as "blocksRead",
			blk_read_time::real as "readMilliseconds",
			session_time::real as "sessionMilliseconds",
			temp_bytes::text as "temporaryBytes",
			tup_inserted::text as "tuplesInserted",
			tup_returned::text as "tuplesRead",
			blk_write_time::real as "writeMilliseconds"
		from pg_stat_database
		where datname = current_database()
	`);
	const walStats = await client.query<{
		readonly buffersFull: string;
		readonly bytes: string;
		readonly fullPageImages: string;
		readonly records: string;
	}>(`
		select wal_bytes::text as bytes,
			wal_fpi::text as "fullPageImages",
			wal_records::text as records,
			wal_buffers_full::text as "buffersFull"
		from pg_stat_wal
	`);
	const cancellationRecovered = await verifyCancellationRecovery(client);
	const concurrency: Readonly<Record<string, LatencySummary>> = Object.fromEntries(
		await Promise.all(
			[1, 16, 64].map(async (workers) => [
				String(workers),
				await runConcurrencyTier(connectionString, workers, sampleCount),
			]),
		),
	);
	for (const [workers, summary] of Object.entries(concurrency)) {
		if (summary.timedOut > 0)
			throw new Error(
				`Adaptive text Search timed out ${summary.timedOut} samples at concurrency ${workers}`,
			);
	}
	let pgroongaWal: QueryResult<PgroongaWalRow> | null = null;
	if (!(reuseFixture && retainedWalStart === undefined)) {
		try {
			pgroongaWal = await client.query<PgroongaWalRow>(
				`
						select coalesce(sum(count), 0)::text as records,
							coalesce(sum(record_size), 0)::text as "recordBytes",
							coalesce(sum(fpi_size), 0)::text as "fullPageImageBytes",
							coalesce(sum(combined_size), 0)::text as bytes
						from pg_get_wal_stats($1::pg_lsn, $2::pg_lsn, true)
						where "resource_manager/record_type" like 'PGroonga/%'
					`,
				[walAnalysisStart, qualificationWalAfter.rows[0]?.lsn],
			);
		} catch (error) {
			// A long fixture load may rotate the starting WAL segment before reporting.
			// Search qualification remains valid; only optional WAL attribution is unavailable.
			if (!hasPostgresErrorCode(error, "58P01")) throw error;
		}
	}
	const runtimeRow = runtime.rows[0];
	const databaseStatsRow = databaseStats.rows[0];
	const walStatsRow = walStats.rows[0];
	const pgroongaWalRow = pgroongaWal?.rows[0] ?? null;
	if (!runtimeRow || !databaseStatsRow || !walStatsRow)
		throw new Error("PostgreSQL returned incomplete runtime capacity statistics");
	console.info(
		JSON.stringify(
			{
				schemaVersion: 7,
				rowCount,
				sampleCountPerConcurrency: sampleCount,
				loadMilliseconds,
				loadRowsPerSecond:
					loadMilliseconds === null
						? null
						: Math.round((rowCount * 1000) / loadMilliseconds),
				loadWalBytes: reuseFixture ? null : Number(loadWal.rows[0]?.bytes ?? "0"),
				qualificationWalBytes: Number(qualificationWal.rows[0]?.bytes ?? "0"),
				pgroongaWal:
					pgroongaWalRow === null
						? null
						: {
								bytes: Number(pgroongaWalRow.bytes),
								fullPageImageBytes: Number(pgroongaWalRow.fullPageImageBytes),
								recordBytes: Number(pgroongaWalRow.recordBytes),
								records: Number(pgroongaWalRow.records),
							},
				rebuildMilliseconds,
				sizes: {
					tableBytes: Number(sizes.tableBytes),
					metadataIndexBytes: Number(sizes.metadataBytes),
					contentIndexBytes: Number(sizes.contentBytes),
					searchDocumentTableBytes: Number(sizes.searchDocumentTableBytes),
					searchDocumentIndexBytes: Number(sizes.searchDocumentIndexBytes),
					databaseBytes: Number(runtimeRow.databaseBytes),
				},
				runtime: {
					serverVersion: runtimeRow.serverVersion,
					sharedBuffers: runtimeRow.sharedBuffers,
					workMem: runtimeRow.workMem,
				},
				databaseStats: {
					activeMilliseconds: databaseStatsRow.activeMilliseconds,
					blocksHit: Number(databaseStatsRow.blocksHit),
					blocksRead: Number(databaseStatsRow.blocksRead),
					readMilliseconds: databaseStatsRow.readMilliseconds,
					sessionMilliseconds: databaseStatsRow.sessionMilliseconds,
					temporaryBytes: Number(databaseStatsRow.temporaryBytes),
					tuplesInserted: Number(databaseStatsRow.tuplesInserted),
					tuplesRead: Number(databaseStatsRow.tuplesRead),
					writeMilliseconds: databaseStatsRow.writeMilliseconds,
				},
				walStats: {
					buffersFull: Number(walStatsRow.buffersFull),
					bytes: Number(walStatsRow.bytes),
					fullPageImages: Number(walStatsRow.fullPageImages),
					records: Number(walStatsRow.records),
				},
				cancellationRecovered,
				concurrency,
				metadata: {
					planningMilliseconds: metadataPlan[0]["Planning Time"],
					executionMilliseconds: metadataPlan[0]["Execution Time"],
					plan: summarizePlan(metadataPlan[0].Plan),
				},
				body: {
					planningMilliseconds: bodyPlan[0]["Planning Time"],
					executionMilliseconds: bodyPlan[0]["Execution Time"],
					plan: summarizePlan(bodyPlan[0].Plan),
				},
				textCommon: {
					firstPage: {
						planningMilliseconds: textCommonFirstPlan[0]["Planning Time"],
						executionMilliseconds: textCommonFirstPlan[0]["Execution Time"],
						plan: summarizePlan(textCommonFirstPlan[0].Plan),
					},
					deepCursor: {
						ordinal: Math.floor((rowCount - Math.floor(rowCount / 10000)) / 2),
						planningMilliseconds: textCommonDeepPlan[0]["Planning Time"],
						executionMilliseconds: textCommonDeepPlan[0]["Execution Time"],
						plan: summarizePlan(textCommonDeepPlan[0].Plan),
					},
				},
				orderedUpdatedAt: {
					firstPage: {
						planningMilliseconds: updatedAtFirstPlan[0]["Planning Time"],
						executionMilliseconds: updatedAtFirstPlan[0]["Execution Time"],
						plan: summarizePlan(updatedAtFirstPlan[0].Plan),
					},
					deepCursor: {
						ordinal: Math.floor(rowCount / 2),
						planningMilliseconds: updatedAtDeepPlan[0]["Planning Time"],
						executionMilliseconds: updatedAtDeepPlan[0]["Execution Time"],
						plan: summarizePlan(updatedAtDeepPlan[0].Plan),
					},
				},
				tagAdaptiveUpdatedAt: {
					candidateRows: tagCandidateCount,
					seedProbe: {
						planningMilliseconds: tagSeedProbePlan[0]["Planning Time"],
						executionMilliseconds: tagSeedProbePlan[0]["Execution Time"],
						plan: summarizePlan(tagSeedProbePlan[0].Plan),
					},
					firstPage: {
						planningMilliseconds: tagOrderedFirstPlan[0]["Planning Time"],
						executionMilliseconds: tagOrderedFirstPlan[0]["Execution Time"],
						plan: summarizePlan(tagOrderedFirstPlan[0].Plan),
					},
					deepCursor: {
						ordinal: Math.floor(tagCandidateCount / 2),
						planningMilliseconds: tagOrderedDeepPlan[0]["Planning Time"],
						executionMilliseconds: tagOrderedDeepPlan[0]["Execution Time"],
						plan: summarizePlan(tagOrderedDeepPlan[0].Plan),
					},
				},
				orderedBest: {
					positiveRows: positiveCount,
					positiveFirstPage: {
						planningMilliseconds: bestPositiveFirstPlan[0]["Planning Time"],
						executionMilliseconds: bestPositiveFirstPlan[0]["Execution Time"],
						plan: summarizePlan(bestPositiveFirstPlan[0].Plan),
					},
					positiveDeepCursor: {
						ordinal: Math.floor(positiveCount / 2),
						planningMilliseconds: bestPositiveDeepPlan[0]["Planning Time"],
						executionMilliseconds: bestPositiveDeepPlan[0]["Execution Time"],
						plan: summarizePlan(bestPositiveDeepPlan[0].Plan),
					},
					zeroFirstPage: {
						planningMilliseconds: bestZeroFirstPlan[0]["Planning Time"],
						executionMilliseconds: bestZeroFirstPlan[0]["Execution Time"],
						plan: summarizePlan(bestZeroFirstPlan[0].Plan),
					},
					zeroDeepCursor: {
						ordinal: Math.floor((rowCount - positiveCount) / 2),
						planningMilliseconds: bestZeroDeepPlan[0]["Planning Time"],
						executionMilliseconds: bestZeroDeepPlan[0]["Execution Time"],
						plan: summarizePlan(bestZeroDeepPlan[0].Plan),
					},
				},
			},
			null,
			2,
		),
	);
} catch (error) {
	await client.query("rollback").catch(() => undefined);
	throw error;
} finally {
	await client.end();
}
