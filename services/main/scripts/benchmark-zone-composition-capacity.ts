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
const ReviewProfileId = "00000000-0000-4000-8000-000000000005";
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
		if (Array.isArray(children))
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

function requireBoundedProbe(
	label: string,
	plan: PlanSummary,
	expectedRows: number,
	maximumExecutionMilliseconds: number,
): void {
	if (plan.rootActualRows !== expectedRows)
		throw new Error(`${label} returned ${plan.rootActualRows} rows; expected ${expectedRows}`);
	if (plan.executionMilliseconds > maximumExecutionMilliseconds)
		throw new Error(
			`${label} took ${plan.executionMilliseconds} ms; maximum is ${maximumExecutionMilliseconds} ms`,
		);
}

if (!process.argv.includes("--yes"))
	throw new Error(
		"Zone composition capacity fixture creation requires explicit --yes confirmation",
	);
if (process.env.ZONE_COMPOSITION_CAPACITY_DISPOSABLE !== "zone-composition-capacity-v1")
	throw new Error("ZONE_COMPOSITION_CAPACITY_DISPOSABLE=zone-composition-capacity-v1 is required");

const revisionCount = readPositiveIntegerFlag("--revisions", 200_000, 1_000_000);
if (revisionCount < 200_000)
	throw new RangeError(
		"--revisions must be at least 200000 to exercise the active bound against terminal history",
	);
const activeRevisionCount = 100_000;
const hostCount = readPositiveIntegerFlag("--hosts", 10_000, 1_000_000);
if (hostCount > activeRevisionCount)
	throw new RangeError(
		"--hosts cannot exceed the 100000 active-revision bound because every fixture host is host-approved",
	);
const resourcesPerActiveRevision = readPositiveIntegerFlag("--resources", 2, 20);
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
		 values ($1::uuid, 'profile'), ($2::uuid, 'profile'),
			($3::uuid, 'collection'), ($4::uuid, 'collection')`,
		[ProfileId, ReviewProfileId, CollectionId, SecondCollectionId],
	);
	await client.query(
		`insert into public.profile (id, auth_user_id)
		 values ($1::uuid, '00000000-0000-4000-8000-000000000003'::uuid),
			($2::uuid, '00000000-0000-4000-8000-000000000006'::uuid)`,
		[ProfileId, ReviewProfileId],
	);
	await client.query("insert into public.collection (id) values ($1::uuid), ($2::uuid)", [
		CollectionId,
		SecondCollectionId,
	]);
	await client.query(
		`insert into public.unit (id, kind)
		 select md5('rezics-zone-capacity-theme:' || ordinal)::uuid, 'custom_theme'
		 from generate_series(1, $1::integer) ordinal`,
		[themeCount],
	);
	await client.query(
		`insert into public.custom_theme (id)
		 select md5('rezics-zone-capacity-theme:' || ordinal)::uuid
		 from generate_series(1, $1::integer) ordinal`,
		[themeCount],
	);
	await client.query(
		`insert into public.unit (id, kind)
		 select md5('rezics-zone-capacity-host:' || ordinal)::uuid, 'zone'
		 from generate_series(1, $1::integer) ordinal`,
		[hostCount],
	);
	await client.query(
		`insert into public.unit (id, kind, status, published_at)
		 select md5('rezics-zone-capacity-tag:' || ordinal)::uuid, 'tag', 'published', now()
		 from generate_series(1, $1::integer) ordinal`,
		[candidateCount],
	);
	await client.query(
		`insert into public.collection_item (collection_id, unit_id, position)
		 select $1::uuid, md5('rezics-zone-capacity-tag:' || ordinal)::uuid,
			'a' || lpad(ordinal::text, 8, '0')
		 from generate_series(1, $2::integer) ordinal`,
		[CollectionId, candidateCount],
	);
	await client.query(
		`insert into public.collection_item (collection_id, unit_id, position)
		 select $1::uuid, md5('rezics-zone-capacity-tag:' || ordinal)::uuid,
			'a' || lpad(ordinal::text, 8, '0')
		 from generate_series(1, $2::integer) ordinal where ordinal % 2 = 0`,
		[SecondCollectionId, candidateCount],
	);
	// Competing collections keep the target predicates selective enough to
	// exercise the production index plan instead of a toy whole-table scan.
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
		 select $1::uuid, md5('rezics-zone-capacity-tag:' || ordinal)::uuid,
			'a' || lpad(ordinal::text, 8, '0')
		 from generate_series(1, $2::integer) ordinal`,
		[ProfileId, candidateCount],
	);

	await client.query(
		`with generated as (
			select ordinal,
				case when ordinal <= $2::integer then 'approved'
					when ordinal <= least($3::integer, $2::integer + 10000) then
						case (ordinal - $2::integer) % 3
							when 0 then 'pending_automated'
							when 1 then 'pending_human'
							else 'revalidation_required' end
					when ordinal <= $3::integer then 'approved'
					else 'rejected' end as review_state
			from generate_series(1, $1::integer) ordinal
		)
		insert into public.custom_theme_revision (
			id, custom_theme_unit_id, target_contract, execution_mode, resource_mode,
			manifest_document, manifest_sha256, source_archive_sha256, review_state,
			approval_scope, approved_host_unit_id, review_evidence, review_evidence_sha256,
			automated_review_attempts, next_automated_review_at, submitted_by_profile_id,
			reviewed_by_profile_id, reviewed_at, decision_reason
		)
		select md5('rezics-zone-capacity-revision:' || ordinal)::uuid,
			md5('rezics-zone-capacity-theme:' || (1 + ((ordinal - 1) % $4::integer)))::uuid,
			'rezics.unit.presentation@0', 'host_full_trust', 'external_live',
			jsonb_build_object(
				'schemaVersion', 0, 'targetContract', 'rezics.unit.presentation@0',
				'executionMode', 'host_full_trust', 'resourceMode', 'external_live',
				'fragments', '[]'::jsonb, 'styles', '[]'::jsonb, 'scripts', '[]'::jsonb,
				'declaredRuntimeOrigins', jsonb_build_object(
					'connect', '[]'::jsonb, 'image', '[]'::jsonb,
					'font', '[]'::jsonb, 'frame', '[]'::jsonb, 'media', '[]'::jsonb)),
			repeat('a', 64), repeat('b', 64), review_state, 'host_unit',
			case when review_state in ('approved', 'revalidation_required')
				then md5('rezics-zone-capacity-host:' || (1 + ((ordinal - 1) % $2::integer)))::uuid
				else null end,
			case when review_state = 'pending_automated' then null
				else jsonb_build_object('automatedStatus', 'passed', 'fixture', true) end,
			case when review_state = 'pending_automated' then null else repeat('c', 64) end,
			case when review_state = 'pending_automated' then 0 else 1 end,
			now() - ((ordinal % 3600)::text || ' seconds')::interval, $5::uuid,
			case when review_state in ('approved', 'rejected', 'revalidation_required')
				then $6::uuid else null end,
			case when review_state in ('approved', 'rejected', 'revalidation_required')
				then now() else null end,
			case when review_state = 'rejected' then 'capacity fixture rejection' else null end
		from generated`,
		[revisionCount, hostCount, activeRevisionCount, themeCount, ProfileId, ReviewProfileId],
	);
	await client.query(
		`insert into public.unit_custom_theme_installation (
			host_unit_id, target_contract, revision_id, installed_by_profile_id)
		 select md5('rezics-zone-capacity-host:' || ordinal)::uuid,
			'rezics.unit.presentation@0',
			md5('rezics-zone-capacity-revision:' || ordinal)::uuid, $2::uuid
		 from generate_series(1, $1::integer) ordinal`,
		[hostCount, ProfileId],
	);
	await client.query(
		`insert into public.unit_presentation_document (host_unit_id, target_contract, document)
		 select md5('rezics-zone-capacity-host:' || ordinal)::uuid,
			'rezics.unit.presentation@0',
			jsonb_build_object(
				'_type', 'unit-presentation-document', '_key', '000000000001',
				'header', jsonb_build_object('_type', 'block-document', '_key', '000000000002', 'blocks', '[]'::jsonb),
				'footer', jsonb_build_object('_type', 'block-document', '_key', '000000000003', 'blocks', '[]'::jsonb))
		 from generate_series(1, $1::integer) ordinal`,
		[hostCount],
	);
	await client.query(
		`insert into public.custom_theme_revision_external_resource (
			revision_id, resource_key, role, requested_url, final_url, origin,
			observed_sha256, observed_byte_length, observed_content_type,
			integrity_metadata, integrity_waiver_reason, cors_allows_anonymous,
			observed_at, current_health_state, last_checked_at, next_check_at,
			monitor_failure_count, review_evidence)
		 select revision.id, 'module:' || resource_ordinal, 'module_dependency',
			'https://cdn.example.test/module-' || resource_ordinal || '.js',
			'https://cdn.example.test/module-' || resource_ordinal || '.js',
			'https://cdn.example.test', repeat('d', 64), 4096, 'text/javascript',
			case when resource_ordinal % 2 = 0 then 'sha384-YWJj' else null end,
			case when resource_ordinal % 2 = 1 then 'capacity fixture waiver' else null end,
			true, now(), 'current', now(),
			now() - ((resource_ordinal * 10)::text || ' seconds')::interval,
			0, '{}'::jsonb
		 from public.custom_theme_revision revision
		 cross join generate_series(1, $1::integer) resource_ordinal
		 where revision.review_state in ('approved', 'revalidation_required')`,
		[resourcesPerActiveRevision],
	);
	await client.query("commit");
	await client.query(
		`analyze public.unit, public.collection_item, public.unit_follow,
			public.custom_theme_revision, public.custom_theme_revision_external_resource,
			public.unit_custom_theme_installation, public.unit_presentation_document`,
	);

	const explain = async (sql: string, parameters: readonly unknown[] = []) => {
		const result = await client.query<{ readonly "QUERY PLAN": ExplainResult }>(
			`explain (analyze, buffers, format json) ${sql}`,
			[...parameters],
		);
		const plan = result.rows[0]?.["QUERY PLAN"];
		if (!plan) throw new Error("PostgreSQL returned no benchmark plan");
		return summarizePlan(plan);
	};
	const selectedHostResult = await client.query<{ readonly id: string }>(
		"select md5('rezics-zone-capacity-host:1')::uuid::text as id",
	);
	const selectedHost = selectedHostResult.rows[0]?.id;
	const selectedTheme = await client.query<{ readonly id: string }>(
		"select md5('rezics-zone-capacity-theme:1')::uuid::text as id",
	);
	const plans = {
		collectionCandidates: await explain(
			`select item.unit_id from public.collection_item item
			 join public.unit candidate on candidate.id = item.unit_id
			 where item.collection_id = $1::uuid and candidate.kind = 'tag'
			 order by item.unit_id limit 1000`,
			[CollectionId],
		),
		collectionAllOfCandidates: await explain(
			`(select unit_id from public.collection_item where collection_id = $1::uuid)
			 intersect
			 (select unit_id from public.collection_item where collection_id = $2::uuid)
			 limit 4097`,
			[CollectionId, SecondCollectionId],
		),
		followedCandidates: await explain(
			`select relation.unit_id from public.unit_follow relation
			 join public.unit candidate on candidate.id = relation.unit_id
			 where relation.follower_profile_id = $1::uuid and candidate.kind = 'tag'
			 order by relation.unit_id limit 1000`,
			[ProfileId],
		),
		reviewQueue: await explain(
			`select id from public.custom_theme_revision
			 where review_state in ('pending_automated', 'pending_human', 'revalidation_required')
			 order by id limit 101`,
		),
		reviewQueueAdmission: await explain(
			`select id from public.custom_theme_revision
			 where review_state in ('pending_automated', 'pending_human', 'revalidation_required')
			 order by id offset 10000 limit 1`,
		),
		activeRevisionAdmission: await explain(
			`select id from public.custom_theme_revision
			 where review_state in ('pending_automated', 'pending_human', 'approved', 'revalidation_required')
			 order by id offset 99999 limit 1`,
		),
		automatedQueue: await explain(
			`select id from public.custom_theme_revision
			 where review_state in ('pending_automated', 'revalidation_required')
				and next_automated_review_at <= now()
			 order by next_automated_review_at, id limit 32`,
		),
		monitorQueue: await explain(
			`select revision_id, resource_key
			 from public.custom_theme_revision_external_resource
			 where next_check_at <= now()
			 order by next_check_at, revision_id, resource_key limit 32`,
		),
		themeRevisions: await explain(
			`select id from public.custom_theme_revision
			 where custom_theme_unit_id = $1::uuid order by id limit 101`,
			[selectedTheme.rows[0]?.id],
		),
		hostResolution: await explain(
			`select installation.revision_id
			 from public.unit_custom_theme_installation installation
			 join public.custom_theme_revision revision
				on revision.id = installation.revision_id
				and revision.target_contract = installation.target_contract
			 where installation.host_unit_id = $1::uuid
				and installation.target_contract = 'rezics.unit.presentation@0'
				and revision.review_state = 'approved'
				and revision.approved_host_unit_id = installation.host_unit_id`,
			[selectedHost],
		),
		presentationLookup: await explain(
			`select document from public.unit_presentation_document
			 where host_unit_id = $1::uuid
				and target_contract = 'rezics.unit.presentation@0'`,
			[selectedHost],
		),
	};
	requireIndex("Collection candidates", plans.collectionCandidates, "collection_item_pkey");
	requireIndex("Collection all-of", plans.collectionAllOfCandidates, "collection_item_pkey");
	requireIndex("Followed candidates", plans.followedCandidates, "unit_follow_pkey");
	requireIndex("Review queue", plans.reviewQueue, "custom_theme_revision_review_queue_idx");
	requireIndex(
		"Review queue admission",
		plans.reviewQueueAdmission,
		"custom_theme_revision_review_queue_idx",
	);
	requireBoundedProbe("Review queue admission", plans.reviewQueueAdmission, 0, 100);
	requireBoundedProbe("Active revision admission", plans.activeRevisionAdmission, 1, 500);
	requireIndex(
		"Automated queue",
		plans.automatedQueue,
		"custom_theme_revision_automated_queue_idx",
	);
	requireIndex("Monitor queue", plans.monitorQueue, "custom_theme_external_resource_monitor_idx");
	requireIndex("Theme revisions", plans.themeRevisions, "custom_theme_revision_theme_id_idx");
	requireIndex("Host resolution", plans.hostResolution, "unit_custom_theme_installation_pkey");
	requireIndex("Presentation lookup", plans.presentationLookup, "unit_presentation_document_pkey");

	const relationSizes = async (relation: string) => {
		const result = await client.query<{
			readonly heapBytes: string;
			readonly indexBytes: string;
			readonly rows: string;
		}>(
			`select pg_relation_size($1::regclass)::text as "heapBytes",
				pg_indexes_size($1::regclass)::text as "indexBytes",
				count(*)::text as rows from ${relation}`,
			[relation],
		);
		return result.rows[0];
	};
	console.log(
		JSON.stringify(
			{
				fixture: {
					activeRevisionCount,
					candidateCount,
					hostCount,
					resourcesPerActiveRevision,
					revisionCount,
					themeCount,
				},
				plans,
				storage: {
					revisions: await relationSizes("public.custom_theme_revision"),
					resources: await relationSizes("public.custom_theme_revision_external_resource"),
					installations: await relationSizes("public.unit_custom_theme_installation"),
					presentations: await relationSizes("public.unit_presentation_document"),
				},
				capacityProjection: {
					installationBytes: {
						at500Million: [500_000_000 * 280, 500_000_000 * 360],
						at3Billion: [3_000_000_000 * 280, 3_000_000_000 * 360],
					},
					presentationRawBytesAt4KiB: {
						at500Million: 500_000_000 * 4096,
						at3Billion: 3_000_000_000 * 4096,
					},
					maximumActiveResourceRows: 100_000 * 512,
				},
			},
			null,
			2,
		),
	);
} finally {
	await client.end();
}
