import assert from "node:assert/strict";
import { Client } from "pg";
import { operationalPartitionTables } from "./operational-partitions";

/** @internal Compensate for Atlas Community omitting physical children from inspection. */
export async function checkOperationalPartitions(client: Client): Promise<void> {
	for (const table of operationalPartitionTables) {
		const result = await client.query<{ name: string; bound: string; key: string }>(
			`select c.relname as name,pg_get_expr(c.relpartbound,c.oid) as bound,pg_get_partkeydef(p.oid) as key from pg_inherits i join pg_class p on p.oid=i.inhparent join pg_namespace n on n.oid=p.relnamespace join pg_class c on c.oid=i.inhrelid where n.nspname='public' and p.relname=$1 order by c.relname`,
			[table],
		);
		assert.equal(result.rows.length, 64, `${table} must have exactly 64 children`);
		for (let i = 0; i < 64; i++) {
			const row = result.rows[i];
			assert.ok(row);
			assert.equal(row.name, `${table}_p${String(i).padStart(2, "0")}`);
			assert.equal(row.key, "RANGE (routing_bucket)");
			assert.equal(row.bound, `FOR VALUES FROM (${i * 16}) TO (${(i + 1) * 16})`);
		}
		const triggers = await client.query<{
			parentCount: number;
			cloneCount: number;
			invalidCount: number;
		}>(
			`
          with parents as (
            select t.* from pg_trigger t join pg_class c on c.oid=t.tgrelid
            join pg_namespace n on n.oid=c.relnamespace
            where n.nspname='public' and c.relname=$1 and not t.tgisinternal
          ), clones as (
            select t.*, p.oid as parent_oid,
              (t.tgname=p.tgname and t.tgfoid=p.tgfoid and t.tgtype=p.tgtype
               and t.tgenabled='O' and p.tgenabled='O' and t.tgargs=p.tgargs
               and t.tgattr=p.tgattr and t.tgnargs=p.tgnargs
               and t.tgdeferrable=p.tgdeferrable and t.tginitdeferred=p.tginitdeferred
               and t.tgqual::text is not distinct from p.tgqual::text) as matches
            from pg_trigger t join pg_inherits i on i.inhrelid=t.tgrelid
            join pg_class c on c.oid=i.inhparent join pg_namespace n on n.oid=c.relnamespace
            left join parents p on p.oid=t.tgparentid
            where n.nspname='public' and c.relname=$1 and not t.tgisinternal
          ) select (select count(*)::int from parents) as "parentCount",
            count(*)::int as "cloneCount", count(*) filter(where matches is not true)::int as "invalidCount" from clones`,
			[table],
		);
		const parentCount =
			table === "operational_outbox" ? 3 : table === "operational_relay_pending" ? 0 : 2;
		assert.deepEqual(
			triggers.rows,
			[{ parentCount, cloneCount: parentCount * 64, invalidCount: 0 }],
			`${table} must inherit every enabled canonical trigger on every child`,
		);
	}
}

if (import.meta.main) {
	const connectionString = process.env.DATABASE_URL;
	if (!connectionString || process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE !== "1")
		throw new Error("Explicit disposable target required");
	const target = new URL(connectionString);
	if (
		!["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) ||
		!/^\/rezics_atlas(?:_durability)?$/.test(target.pathname)
	)
		throw new Error("Use a loopback disposable atlas target");
	const client = new Client({ connectionString });
	await client.connect();
	try {
		await checkOperationalPartitions(client);
		console.info(
			"Verified 256 operational partition names, ranges, parent keys and 448 enabled trigger clones",
		);
	} finally {
		await client.end();
	}
}
