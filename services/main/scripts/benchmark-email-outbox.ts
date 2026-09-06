import assert from "node:assert/strict";
import { Client } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString || process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE !== "1")
	throw new Error("DATABASE_URL and REZICS_DISPOSABLE_MIGRATION_FIXTURE=1 are required");
const url = new URL(connectionString);
if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || url.pathname !== "/rezics_atlas")
	throw new Error("Email workload checks require a loopback disposable rezics_atlas database");
const client = new Client({ connectionString, statement_timeout: 30_000 });
await client.connect();
try {
	await client.query("begin");
	assert.equal(
		(await client.query("select current_database() as name")).rows[0]?.name,
		"rezics_atlas",
	);
	assert.equal(
		(await client.query("select exists(select 1 from public.email_outbox) as occupied")).rows[0]
			?.occupied,
		false,
	);
	await client.query(`insert into public.email_outbox (kind, status, accepted_at, provider_status)
		select 'verify_email', 'accepted', clock_timestamp(), 'logged' from generate_series(1, 100000)`);
	await client.query(`insert into public.email_outbox (kind, status, action_url, recipient_email, locale, available_at)
		select 'verify_email', 'pending', 'https://example.invalid/fixture', 'fixture@example.invalid', 'en',
			clock_timestamp() - g * interval '1 millisecond' from generate_series(1, 100000) g`);
	await client.query(`insert into public.email_outbox (kind, status, action_url, recipient_email, locale, lease_expires_at)
		select 'verify_email', 'processing', 'https://example.invalid/fixture', 'fixture@example.invalid', 'en',
			clock_timestamp() + (g - 50000) * interval '1 millisecond' from generate_series(1, 100000) g`);
	await client.query("analyze public.email_outbox");
	const plans: Record<string, unknown> = {};
	for (const [name, query, expectedIndex] of [
		[
			"pending",
			`select id from public.email_outbox where status = 'pending' and available_at <= statement_timestamp()
			order by available_at, created_at limit 20 for update skip locked`,
			"email_outbox_pending_idx",
		],
		[
			"expired",
			`select id from public.email_outbox where status = 'processing' and lease_expires_at <= statement_timestamp()
			order by lease_expires_at limit 20 for update skip locked`,
			"email_outbox_processing_lease_idx",
		],
	] as const) {
		const result = await client.query(`explain (analyze, buffers, format json) ${query}`);
		const plan: unknown = result.rows[0]?.["QUERY PLAN"];
		const serialized = JSON.stringify(plan);
		assert.ok(serialized.includes(expectedIndex), `${name} did not use the expected partial index`);
		assert.ok(
			!serialized.includes('"Node Type":"Sort"'),
			`${name} sorted eligible rows before limiting`,
		);
		plans[name] = plan;
	}
	const widths = await client.query(`select status, avg(pg_column_size(sample)) as average_row_bytes
		from (select * from public.email_outbox tablesample system (5)) sample group by status order by status`);
	const sizes = await client.query(`select pg_relation_size('public.email_outbox') as heap_bytes,
		pg_indexes_size('public.email_outbox') as index_bytes`);
	const version = await client.query(
		"select current_setting('server_version') as postgres, (select extversion from pg_extension where extname = 'pgroonga') as pgroonga",
	);
	console.info(
		JSON.stringify({
			fixtureRows: 300000,
			versions: version.rows[0],
			widths: widths.rows,
			sizes: sizes.rows[0],
			plans,
		}),
	);
} finally {
	await client.query("rollback");
	await client.end();
}
