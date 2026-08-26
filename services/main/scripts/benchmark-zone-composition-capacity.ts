import { Client } from "pg";

type PlanNode = Readonly<Record<string, unknown>>;

type ExplainResult = readonly [
	{
		readonly "Execution Time": number;
		readonly "Planning Time": number;
		readonly Plan: PlanNode;
	},
];

type PlanSummary = Readonly<{
	executionMilliseconds: number;
	indexNames: readonly string[];
	planningMilliseconds: number;
	rootActualRows: number;
	sharedHitBlocks: number;
	sharedReadBlocks: number;
}>;

const ProfileId = "00000000-0000-4000-8000-000000000001";
const CollectionId = "00000000-0000-4000-8000-000000000002";
const SecondCollectionId = "00000000-0000-4000-8000-000000000004";

function readPositiveIntegerFlag(name: string, fallback: number, maximum: number): number {
	const position = process.argv.indexOf(name);
	if (position < 0) return fallback;
	const value = Number(process.argv[position + 1]);
	if (!Number.isSafeInteger(value) || value < 1 || value > maximum)
		throw new RangeError(`${name} must be an integer between 1 and ${maximum}`);
	return value;
}

function summarizePlan(result: ExplainResult): PlanSummary {
	const envelope = result[0];
	if (!envelope) throw new Error("PostgreSQL returned no EXPLAIN envelope");
	const indexNames = new Set<string>();
	const visit = (node: PlanNode): void => {
		const indexName = node["Index Name"];
		if (typeof indexName === "string") indexNames.add(indexName);
		const children = node.Plans;
		if (!Array.isArray(children)) return;
		for (const child of children)
			if (typeof child === "object" && child !== null) visit(child as PlanNode);
	};
	visit(envelope.Plan);
	return {
		executionMilliseconds: envelope["Execution Time"],
		indexNames: [...indexNames].sort(),
		planningMilliseconds: envelope["Planning Time"],
		rootActualRows:
			typeof envelope.Plan["Actual Rows"] === "number" ? envelope.Plan["Actual Rows"] : 0,
		sharedHitBlocks:
			typeof envelope.Plan["Shared Hit Blocks"] === "number"
				? envelope.Plan["Shared Hit Blocks"]
				: 0,
		sharedReadBlocks:
			typeof envelope.Plan["Shared Read Blocks"] === "number"
				? envelope.Plan["Shared Read Blocks"]
				: 0,
	};
}

function requireIndex(label: string, plan: PlanSummary, expected: string): void {
	if (!plan.indexNames.includes(expected))
		throw new Error(
			`${label} did not use ${expected}; used: ${plan.indexNames.join(", ") || "none"}`,
		);
}

if (!process.argv.includes("--yes"))
	throw new Error(
		"Zone composition capacity fixture creation requires explicit --yes confirmation",
	);
if (process.env.ZONE_COMPOSITION_CAPACITY_DISPOSABLE !== "zone-composition-capacity-v1")
	throw new Error("ZONE_COMPOSITION_CAPACITY_DISPOSABLE=zone-composition-capacity-v1 is required");
const revisionCount = readPositiveIntegerFlag("--revisions", 100_000, 1_000_000);
if (revisionCount < 10_000)
	throw new RangeError("--revisions must be at least 10000 to exercise queue-state skew");
const candidateCount = readPositiveIntegerFlag("--candidates", 10_000, 100_000);
const themeCount = readPositiveIntegerFlag("--themes", 1_000, 10_000);
const connectionString = process.env.DATABASE_ADMIN_URL;
if (!connectionString) throw new Error("DATABASE_ADMIN_URL is required");
if (new URL(connectionString).pathname.slice(1) !== "rezics_atlas")
	throw new Error(
		"Zone composition capacity benchmarks may run only against disposable rezics_atlas",
	);

const client = new Client({ connectionString });
await client.connect();
try {
	await client.query("begin");
	await client.query("set local synchronous_commit = off");
	await client.query("set local session_replication_role = replica");
	await client.query(
		`insert into public.unit (id, kind)
		 values ($1::uuid, 'profile'), ($2::uuid, 'collection'), ($3::uuid, 'collection')`,
		[ProfileId, CollectionId, SecondCollectionId],
	);
	await client.query(
		`insert into public.profile (id, auth_user_id)
		 values ($1::uuid, '00000000-0000-4000-8000-000000000003'::uuid)`,
		[ProfileId],
	);
	await client.query("insert into public.collection (id) values ($1::uuid), ($2::uuid)", [
		CollectionId,
		SecondCollectionId,
	]);
	await client.query(
		`insert into public.unit (id, kind)
		 select md5('rezics-zone-capacity-theme:' || ordinal)::uuid, 'zone_theme'
		 from generate_series(1, $1::integer) ordinal`,
		[themeCount],
	);
	await client.query(
		`insert into public.zone_theme (id)
		 select md5('rezics-zone-capacity-theme:' || ordinal)::uuid
		 from generate_series(1, $1::integer) ordinal`,
		[themeCount],
	);
	await client.query(
		`insert into public.unit (id, kind, status, published_at)
		 select md5('rezics-zone-capacity-tag:' || ordinal)::uuid,
			'tag', 'published', now()
		 from generate_series(1, $1::integer) ordinal`,
		[candidateCount],
	);
	await client.query(
		`insert into public.collection_item (collection_id, unit_id, position)
		 select $1::uuid,
			md5('rezics-zone-capacity-tag:' || ordinal)::uuid,
			'a' || lpad(ordinal::text, 8, '0')
		 from generate_series(1, $2::integer) ordinal`,
		[CollectionId, candidateCount],
	);
	await client.query(
		`insert into public.collection_item (collection_id, unit_id, position)
		 select $1::uuid,
			md5('rezics-zone-capacity-tag:' || ordinal)::uuid,
			'a' || lpad(ordinal::text, 8, '0')
		 from generate_series(1, $2::integer) ordinal
		 where ordinal % 2 = 0`,
		[SecondCollectionId, candidateCount],
	);
	await client.query(
		`insert into public.unit (id, kind)
		 select md5('rezics-zone-capacity-background-collection:' || ordinal)::uuid, 'collection'
		 from generate_series(1, 100) ordinal`,
	);
	await client.query(
		`insert into public.collection (id)
		 select md5('rezics-zone-capacity-background-collection:' || ordinal)::uuid
		 from generate_series(1, 100) ordinal`,
	);
	await client.query(
		`insert into public.collection_item (collection_id, unit_id, position)
		 select md5('rezics-zone-capacity-background-collection:' || collection_ordinal)::uuid,
			md5('rezics-zone-capacity-tag:' || tag_ordinal)::uuid,
			'a' || lpad(tag_ordinal::text, 8, '0')
		 from generate_series(1, 100) collection_ordinal
		 cross join generate_series(1, 1000) tag_ordinal`,
	);
	await client.query(
		`insert into public.unit_follow (follower_profile_id, unit_id, position)
		 select $1::uuid,
			md5('rezics-zone-capacity-tag:' || ordinal)::uuid,
			'a' || lpad(ordinal::text, 8, '0')
		 from generate_series(1, $2::integer) ordinal`,
		[ProfileId, candidateCount],
	);
	await client.query(
		`insert into public.zone_theme_revision (
			id, theme_unit_id, contract_version, source_css, transformed_css,
			sha256, state, automated_review, submitted_by_profile_id
		)
		select md5('rezics-zone-capacity-revision:' || ordinal)::uuid,
			md5('rezics-zone-capacity-theme:' || (1 + ((ordinal - 1) % $2::integer)))::uuid,
			case when ordinal % 100 between 3 and 7 then '0.9.0' else '1.0.0' end,
			'[data-block-type="unit-list"]{color:var(--zone-accent)}',
			'[data-zone-theme-scope] [data-block-type="unit-list"]{color:var(--zone-accent)}',
			repeat('a', 64),
			case
				when ordinal % 100 = 0 then 'pending_automated'
				when ordinal % 100 = 1 then 'pending_human'
				when ordinal % 100 = 2 then 'revalidation_required'
				when ordinal % 100 between 3 and 12 then 'approved'
				else 'rejected'
			end,
			'{}'::jsonb,
			$3::uuid
		from generate_series(1, $1::integer) ordinal`,
		[revisionCount, themeCount, ProfileId],
	);
	await client.query(
		`insert into public.image_asset (
			id, uploader_profile_id, owner_profile_id, status, access
		)
		select md5('rezics-zone-capacity-asset:' || ordinal)::uuid,
			$2::uuid, $2::uuid, 'ready', 'public'
		from generate_series(1, $1::integer) ordinal
		where ordinal % 100 between 3 and 12`,
		[revisionCount, ProfileId],
	);
	await client.query(
		`insert into public.zone_theme_revision_asset (revision_id, asset_id)
		select md5('rezics-zone-capacity-revision:' || ordinal)::uuid,
			md5('rezics-zone-capacity-asset:' || ordinal)::uuid
		from generate_series(1, $1::integer) ordinal
		where ordinal % 100 between 3 and 12`,
		[revisionCount],
	);
	await client.query("commit");
	await client.query(
		"analyze public.unit, public.collection_item, public.unit_follow, public.zone_theme_revision, public.zone_theme_revision_asset, public.image_asset",
	);

	const explain = async (
		sql: string,
		parameters: readonly unknown[] = [],
	): Promise<PlanSummary> => {
		const result = await client.query<{ readonly "QUERY PLAN": ExplainResult }>(
			`explain (analyze, buffers, format json) ${sql}`,
			[...parameters],
		);
		const plan = result.rows[0]?.["QUERY PLAN"];
		if (!plan) throw new Error("PostgreSQL returned no benchmark plan");
		return summarizePlan(plan);
	};
	const queueCursor = await client.query<{ readonly id: string }>(
		`select id from public.zone_theme_revision
		 where state in ('pending_automated', 'pending_human', 'revalidation_required')
		 order by id offset 1000 limit 1`,
	);
	const revalidationCursor = await client.query<{ readonly id: string }>(
		`select id from public.zone_theme_revision
		 where state = 'approved' and contract_version = '0.9.0'
		 order by id offset 1000 limit 1`,
	);
	const selectedTheme = await client.query<{ readonly id: string }>(
		"select md5('rezics-zone-capacity-theme:1')::uuid::text as id",
	);
	const assetRevisionIds = await client.query<{ readonly id: string }>(
		`select id from public.zone_theme_revision
		 where state = 'approved' order by id limit 100`,
	);
	const plans = {
		collectionCandidates: await explain(
			`select item.unit_id
			 from public.collection_item item
			 join public.unit candidate on candidate.id = item.unit_id
			 where item.collection_id = $1::uuid and candidate.kind = 'tag'
			 order by item.unit_id limit 1000`,
			[CollectionId],
		),
		collectionAllOfCandidates: await explain(
			`(select search_collection_seed.unit_id
				from public.collection_item search_collection_seed
				where search_collection_seed.collection_id = $1::uuid)
			 intersect
			 (select search_collection_seed.unit_id
				from public.collection_item search_collection_seed
				where search_collection_seed.collection_id = $2::uuid)
			 limit 4097`,
			[CollectionId, SecondCollectionId],
		),
		followedCandidates: await explain(
			`select relation.unit_id
			 from public.unit_follow relation
			 join public.unit candidate on candidate.id = relation.unit_id
			 where relation.follower_profile_id = $1::uuid and candidate.kind = 'tag'
			 order by relation.unit_id limit 1000`,
			[ProfileId],
		),
		reviewQueue: await explain(
			`select * from public.zone_theme_revision
			 where state in ('pending_automated', 'pending_human', 'revalidation_required')
			 and id > $1::uuid order by id limit 101`,
			[queueCursor.rows[0]?.id],
		),
		revalidation: await explain(
			`select id, source_css from public.zone_theme_revision
			 where state = 'approved' and contract_version = '0.9.0'
			 and id > $1::uuid order by id limit 100`,
			[revalidationCursor.rows[0]?.id],
		),
		themeRevisions: await explain(
			`select * from public.zone_theme_revision
			 where theme_unit_id = $1::uuid order by id limit 101`,
			[selectedTheme.rows[0]?.id],
		),
		revisionAssets: await explain(
			`select revision_id, asset_id from public.zone_theme_revision_asset
			 where revision_id = any($1::uuid[])`,
			[assetRevisionIds.rows.map(({ id }) => id)],
		),
	};
	requireIndex("Collection candidates", plans.collectionCandidates, "collection_item_pkey");
	requireIndex(
		"Collection all-of candidates",
		plans.collectionAllOfCandidates,
		"collection_item_pkey",
	);
	requireIndex("Followed candidates", plans.followedCandidates, "unit_follow_pkey");
	requireIndex("Review queue", plans.reviewQueue, "zone_theme_revision_review_queue_idx");
	requireIndex(
		"Contract revalidation",
		plans.revalidation,
		"zone_theme_revision_approved_contract_id_idx",
	);
	requireIndex("Theme revisions", plans.themeRevisions, "zone_theme_revision_theme_id_idx");
	requireIndex("Revision assets", plans.revisionAssets, "zone_theme_revision_asset_pkey");

	const sizes = await client.query<{
		readonly revisionBytes: string;
		readonly revisionIndexBytes: string;
		readonly revisionRows: string;
	}>(
		`select pg_relation_size('public.zone_theme_revision')::text as "revisionBytes",
			pg_indexes_size('public.zone_theme_revision')::text as "revisionIndexBytes",
			count(*)::text as "revisionRows"
		 from public.zone_theme_revision`,
	);
	const size = sizes.rows[0];
	if (!size) throw new Error("PostgreSQL returned no relation-size sample");
	console.log(
		JSON.stringify(
			{
				fixture: { candidateCount, revisionCount, themeCount },
				plans,
				storage: {
					revisionBytes: Number(size.revisionBytes),
					revisionBytesPerRow: Number(size.revisionBytes) / Number(size.revisionRows),
					revisionIndexBytes: Number(size.revisionIndexBytes),
					revisionIndexBytesPerRow: Number(size.revisionIndexBytes) / Number(size.revisionRows),
				},
			},
			null,
			2,
		),
	);
} finally {
	await client.end();
}
