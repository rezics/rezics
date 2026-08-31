import { Client } from "pg";

const FixtureFlag = "REZICS_DISPOSABLE_MIGRATION_FIXTURE";
const FixtureTagCount = 10_000;
const FixtureIdPrefix = "rezics-tag-public-position-cutover:";
const FixtureTimestamp = "2026-08-31T14:59:07.000Z";

function assert(condition: unknown, message: string): asserts condition {
	if (!condition) throw new Error(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function containsPlanNode(
	value: unknown,
	predicate: (node: Readonly<Record<string, unknown>>) => boolean,
): boolean {
	if (Array.isArray(value)) return value.some((entry) => containsPlanNode(entry, predicate));
	if (!isRecord(value)) return false;
	return (
		predicate(value) || Object.values(value).some((entry) => containsPlanNode(entry, predicate))
	);
}

async function assertDisposableDatabase(client: Client): Promise<void> {
	assert(
		process.env[FixtureFlag] === "1",
		`${FixtureFlag}=1 is required because this check writes disposable fixtures`,
	);
	const result = await client.query<{ readonly database: string }>(
		"select current_database() as database",
	);
	assert(
		result.rows[0]?.database === "rezics_atlas",
		"Tag public-position fixtures may run only in the disposable rezics_atlas database",
	);
}

async function projectionTableExists(client: Client): Promise<boolean> {
	const result = await client.query<{ readonly exists: boolean }>(
		"select to_regclass('public.tag_public_position_stat') is not null as exists",
	);
	return result.rows[0]?.exists === true;
}

async function cleanupFixture(client: Client): Promise<void> {
	await client.query(
		`delete from public.unit
		 where id in (
			select md5($1 || ordinal::text)::uuid
			from generate_series(0, $2::integer) as fixture(ordinal)
		)`,
		[FixtureIdPrefix, FixtureTagCount],
	);
	await client.query(
		`delete from public.vocabulary_node
		 where id in (
			select md5($1 || ordinal::text)::uuid
			from generate_series(0, $2::integer) as fixture(ordinal)
		)`,
		[FixtureIdPrefix, FixtureTagCount],
	);
}

async function seedFixture(client: Client): Promise<void> {
	await assertDisposableDatabase(client);
	assert(
		!(await projectionTableExists(client)),
		"The projection migration must still be pending before its fixture is seeded",
	);
	const pathMembers = await client.query<{ readonly exists: boolean }>(
		"select exists(select 1 from public.tag_path_member limit 1) as exists",
	);
	assert(
		pathMembers.rows[0]?.exists === false,
		"The atomic projection fixture requires empty Tag Path membership",
	);

	await client.query("begin");
	try {
		await cleanupFixture(client);
		await client.query(
			`insert into public.unit(id, kind, created_at, updated_at)
			 select md5($1 || ordinal::text)::uuid, 'tag', $3::timestamptz, $3::timestamptz
			 from generate_series(0, $2::integer - 1) as fixture(ordinal)`,
			[FixtureIdPrefix, FixtureTagCount, FixtureTimestamp],
		);
		await client.query(
			`insert into public.vocabulary_node(id, kind, created_at)
			 select md5($1 || ordinal::text)::uuid, 'concept', $3::timestamptz
			 from generate_series(0, $2::integer - 1) as fixture(ordinal)`,
			[FixtureIdPrefix, FixtureTagCount, FixtureTimestamp],
		);
		await client.query(
			`insert into public.tag(id, created_at, updated_at)
			 select md5($1 || ordinal::text)::uuid, $3::timestamptz, $3::timestamptz
			 from generate_series(0, $2::integer - 1) as fixture(ordinal)`,
			[FixtureIdPrefix, FixtureTagCount, FixtureTimestamp],
		);
		await client.query("commit");
	} catch (error) {
		await client.query("rollback").catch(() => undefined);
		throw error;
	}
	console.info(`Seeded ${FixtureTagCount} pre-migration Tag projection fixtures.`);
}

async function fixtureTagIds(client: Client, limit: number): Promise<readonly string[]> {
	const result = await client.query<{ readonly id: string }>(
		`select md5($1 || ordinal::text)::uuid::text as id
		 from generate_series(0, $2::integer - 1) as fixture(ordinal)
		 order by ordinal`,
		[FixtureIdPrefix, limit],
	);
	return result.rows.map(({ id }) => id);
}

async function fixtureTagId(client: Client, ordinal: number): Promise<string> {
	const result = await client.query<{ readonly id: string }>(
		"select md5($1 || $2::integer::text)::uuid::text as id",
		[FixtureIdPrefix, ordinal],
	);
	const id = result.rows[0]?.id;
	assert(id, `Fixture Tag ${ordinal} has no deterministic ID`);
	return id;
}

async function verifyProjectionShape(client: Client): Promise<void> {
	const result = await client.query<{
		readonly countType: string;
		readonly fixtureCount: string;
		readonly nonzeroCount: string;
	}>(
		`select
			(select format_type(attribute.atttypid, attribute.atttypmod)
			 from pg_catalog.pg_attribute as attribute
			 where attribute.attrelid = 'public.tag_public_position_stat'::regclass
				and attribute.attname = 'public_position_count' and not attribute.attisdropped)
				as "countType",
			count(*)::text as "fixtureCount",
			count(*) filter (where projection.public_position_count <> 0)::text as "nonzeroCount"
		 from public.tag_public_position_stat as projection
		 where projection.tag_id in (
			select md5($1 || ordinal::text)::uuid
			from generate_series(0, $2::integer - 1) as fixture(ordinal)
		)`,
		[FixtureIdPrefix, FixtureTagCount],
	);
	const row = result.rows[0];
	assert(row?.countType === "bigint", "The projection counter must remain bigint at 3B scale");
	assert(
		row.fixtureCount === String(FixtureTagCount) && row.nonzeroCount === "0",
		`Expected ${FixtureTagCount} zero-count projection rows, received ${JSON.stringify(row)}`,
	);

	const indexes = await client.query<{ readonly name: string }>(
		`select index_class.relname as name
		 from pg_catalog.pg_index as index_state
		 join pg_catalog.pg_class as index_class on index_class.oid = index_state.indexrelid
		 where index_state.indrelid = 'public.tag_public_position_stat'::regclass
		 order by index_class.relname`,
	);
	assert(
		indexes.rows.length === 1 && indexes.rows[0]?.name === "tag_public_position_stat_pkey",
		`The dense projection must use only its primary-key index; received ${JSON.stringify(indexes.rows)}`,
	);
}

async function verifyBoundedLookupPlan(client: Client): Promise<void> {
	const ids = await fixtureTagIds(client, 50);
	await client.query("set enable_seqscan = off");
	try {
		const plan = await client.query(
			`explain (analyze, buffers, format json)
			 select tag_id, public_position_count
			 from public.tag_public_position_stat
			 where tag_id = any($1::uuid[])`,
			[ids],
		);
		assert(
			containsPlanNode(plan.rows, (node) => node["Index Name"] === "tag_public_position_stat_pkey"),
			"The 50-key request lookup must use tag_public_position_stat_pkey",
		);
		assert(
			!containsPlanNode(
				plan.rows,
				(node) =>
					node["Node Type"] === "Seq Scan" && node["Relation Name"] === "tag_public_position_stat",
			),
			"The 50-key request lookup must not scan the projection corpus",
		);
	} finally {
		await client.query("reset enable_seqscan");
	}
}

async function verifyDirectMutationGuard(client: Client): Promise<void> {
	const [tagId] = await fixtureTagIds(client, 1);
	assert(tagId, "The direct-mutation fixture Tag is missing");
	await client.query("begin");
	try {
		await client.query(
			"update public.tag_public_position_stat set public_position_count = 1 where tag_id = $1",
			[tagId],
		);
		throw new Error("The trigger-owned projection accepted a direct mutation");
	} catch (error) {
		await client.query("rollback").catch(() => undefined);
		assert(
			isRecord(error) &&
				error.code === "23514" &&
				error.constraint === "tag_public_position_stat_projection_only",
			"The trigger-owned projection must reject direct mutations with its named constraint",
		);
	}
}

async function verifyNewTagSeed(client: Client): Promise<void> {
	const tagId = await fixtureTagId(client, FixtureTagCount);
	await client.query("begin");
	try {
		await client.query(
			`insert into public.unit(id, kind, created_at, updated_at)
			 values ($1, 'tag', $2, $2)`,
			[tagId, FixtureTimestamp],
		);
		await client.query(
			"insert into public.vocabulary_node(id, kind, created_at) values ($1, 'concept', $2)",
			[tagId, FixtureTimestamp],
		);
		await client.query("insert into public.tag(id, created_at, updated_at) values ($1, $2, $2)", [
			tagId,
			FixtureTimestamp,
		]);
		const projection = await client.query<{ readonly count: string }>(
			`select public_position_count::text as count
			 from public.tag_public_position_stat where tag_id = $1`,
			[tagId],
		);
		assert(
			projection.rows[0]?.count === "0",
			"A Tag inserted after cutover must receive an exact zero-count projection row",
		);
		await client.query("commit");
	} catch (error) {
		await client.query("rollback").catch(() => undefined);
		throw error;
	}
}

async function verifyAndCleanFixture(client: Client): Promise<void> {
	await assertDisposableDatabase(client);
	assert(await projectionTableExists(client), "The projection migration did not create its table");
	try {
		await verifyProjectionShape(client);
		await verifyBoundedLookupPlan(client);
		await verifyDirectMutationGuard(client);
		await verifyNewTagSeed(client);
		console.info(
			`Verified the atomic ${FixtureTagCount}-Tag cutover, bigint shape, and 50-key primary-key plan.`,
		);
	} finally {
		await cleanupFixture(client);
	}
}

const connectionString = process.env.DATABASE_ADMIN_URL;
assert(connectionString, "DATABASE_ADMIN_URL is required");
const mode = process.argv[2];
assert(
	mode === "seed" || mode === "verify-and-clean",
	"Usage: check-tag-public-position-projection-cutover.ts <seed|verify-and-clean>",
);
const client = new Client({ connectionString });

try {
	await client.connect();
	if (mode === "seed") await seedFixture(client);
	else await verifyAndCleanFixture(client);
} finally {
	await client.end();
}
