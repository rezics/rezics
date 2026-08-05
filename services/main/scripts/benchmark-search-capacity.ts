import { Client } from "pg";

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
	expression: string;
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

const searchWorkloads: readonly SearchWorkload[] = [
	{
		name: "metadata-distinctive",
		expression:
			"public.current_search_metadata_v1(localization.title, localization.summary, localization.description)",
		query: "capacityneedle1000000",
	},
	{
		name: "metadata-cjk",
		expression:
			"public.current_search_metadata_v1(localization.title, localization.summary, localization.description)",
		query: "銀河",
	},
	{
		name: "metadata-common",
		expression:
			"public.current_search_metadata_v1(localization.title, localization.summary, localization.description)",
		query: "Library",
	},
	{
		name: "body-distinctive",
		expression: "public.current_search_text_v1(localization.content)",
		query: "bodyneedle1000000",
	},
	{
		name: "body-common",
		expression: "public.current_search_text_v1(localization.content)",
		query: "Chapter",
	},
] as const;

function summarizePlan(plan: Record<string, unknown>): PlanSummary {
	const indexNames = new Set<string>();
	const nodeTypes = new Set<string>();
	let sharedHitBlocks = 0;
	let sharedReadBlocks = 0;
	let sharedWrittenBlocks = 0;
	const visit = (node: Record<string, unknown>): void => {
		const nodeType = node["Node Type"];
		if (typeof nodeType === "string") nodeTypes.add(nodeType);
		const indexName = node["Index Name"];
		if (typeof indexName === "string") indexNames.add(indexName);
		const hitBlocks = node["Shared Hit Blocks"];
		if (typeof hitBlocks === "number") sharedHitBlocks += hitBlocks;
		const readBlocks = node["Shared Read Blocks"];
		if (typeof readBlocks === "number") sharedReadBlocks += readBlocks;
		const writtenBlocks = node["Shared Written Blocks"];
		if (typeof writtenBlocks === "number") sharedWrittenBlocks += writtenBlocks;
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
		sharedHitBlocks,
		sharedReadBlocks,
		sharedWrittenBlocks,
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

function searchSql(expression: string): string {
	return `with candidate_localizations as materialized (
			select localization.*
			from public.unit_localization localization
			where ${expression} &@~ $1
			limit 512
		)
		select localization.unit_id
		from candidate_localizations localization
		cross join lateral (
			select authoritative.id
			from public.unit authoritative
			where authoritative.id = localization.unit_id
			  and authoritative.status = 'published'
			  and authoritative.visibility = 'public'
			  and authoritative.moderation_status = 'approved'
			  and authoritative.deleted_at is null
			offset 0
		) authoritative
		order by localization.unit_id
		limit 20`;
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
		await Promise.all(
			clients.map((worker) => worker.query(searchSql(warmup.expression), [warmup.query])),
		);
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
						await worker.query(searchSql(workload.expression), [workload.query]);
						latencies.push(performance.now() - startedAt);
					} catch (error) {
						if (
							typeof error === "object" &&
							error !== null &&
							"code" in error &&
							error.code === "57014"
						) {
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
		if (
			typeof error !== "object" ||
			error === null ||
			!("code" in error) ||
			error.code !== "57014"
		)
			throw error;
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
	if (reuseFixture) {
		const fixture = await client.query<{ readonly rowCount: string }>(`
			select count(*)::text as "rowCount"
			from public.search_capacity_fixture_v1
		`);
		if (Number(fixture.rows[0]?.rowCount) !== rowCount)
			throw new Error("Existing search capacity fixture row count does not match --rows");
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
		await client.query(`
			insert into public.unit (id, kind, status, visibility, published_at)
			select unit_id, 'book', 'published', 'public', now()
			from public.search_capacity_fixture_v1
		`);
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
		await client.query("commit");
		await client.query("analyze public.unit");
		await client.query("analyze public.unit_localization");
		loadMilliseconds = Math.round(performance.now() - loadStartedAt);
	}
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
	const explain = async (expression: string, query: string): Promise<SearchPlan> => {
		const result = await client.query<{ readonly "QUERY PLAN": SearchPlan }>(
			`explain (analyze, buffers, wal, format json) ${searchSql(expression)}`,
			[query],
		);
		const plan = result.rows[0]?.["QUERY PLAN"];
		if (!plan) throw new Error("PostgreSQL returned no benchmark plan");
		return plan;
	};
	const metadataPlan = await explain(
		"public.current_search_metadata_v1(localization.title, localization.summary, localization.description)",
		"capacityneedle1000000",
	);
	const bodyPlan = await explain(
		"public.current_search_text_v1(localization.content)",
		"bodyneedle1000000",
	);
	const sizeResult = await client.query<{
		readonly contentBytes: string;
		readonly metadataBytes: string;
		readonly tableBytes: string;
	}>(`
		with index_sizes(index_name, bytes) as (
			select index_name,
				((inspection #>> '{1,disk_usage}')::bigint
				 + (inspection #>> '{1,table,disk_usage}')::bigint
				 + (inspection #>> '{1,sources,0,table,disk_usage}')::bigint) as bytes
			from (values
				('unit_localization_pgroonga_metadata_idx'),
				('unit_localization_pgroonga_content_idx')
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
			(select bytes::text from index_sizes
			 where index_name = 'unit_localization_pgroonga_metadata_idx') as "metadataBytes",
			(select bytes::text from index_sizes
			 where index_name = 'unit_localization_pgroonga_content_idx') as "contentBytes"
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
	const concurrency = Object.fromEntries(
		await Promise.all(
			[1, 16, 64].map(async (workers) => [
				String(workers),
				await runConcurrencyTier(connectionString, workers, sampleCount),
			]),
		),
	);
	const pgroongaWal =
		reuseFixture && retainedWalStart === undefined
			? null
			: await client.query<{
					readonly bytes: string;
					readonly fullPageImageBytes: string;
					readonly recordBytes: string;
					readonly records: string;
				}>(
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
	const runtimeRow = runtime.rows[0];
	const databaseStatsRow = databaseStats.rows[0];
	const walStatsRow = walStats.rows[0];
	const pgroongaWalRow = pgroongaWal?.rows[0] ?? null;
	if (!runtimeRow || !databaseStatsRow || !walStatsRow)
		throw new Error("PostgreSQL returned incomplete runtime capacity statistics");
	console.info(
		JSON.stringify(
			{
				schemaVersion: 1,
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
