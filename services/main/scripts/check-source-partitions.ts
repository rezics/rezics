import assert from "node:assert/strict";
import type { Client } from "pg";
import { sourcePartitionKeys } from "./source-partitions";

/** @internal Atlas Community omits children; prove their bounds and inherited trigger integrity. */
export async function checkSourcePartitions(client: Client): Promise<void> {
	for (const [table, key] of Object.entries(sourcePartitionKeys)) {
		const children = await client.query<{ name: string; bound: string; key: string }>(
			`select c.relname as name,pg_get_expr(c.relpartbound,c.oid) as bound,
			 pg_get_partkeydef(p.oid) as key from pg_inherits i
			 join pg_class p on p.oid=i.inhparent join pg_namespace n on n.oid=p.relnamespace
			 join pg_class c on c.oid=i.inhrelid
			 where n.nspname='public' and p.relname=$1 order by c.relname`,
			[table],
		);
		assert.equal(children.rows.length, 64, `${table} must have exactly 64 children`);
		for (let i = 0; i < 64; i++)
			assert.deepEqual(children.rows[i], {
				name: `${table}_p${String(i).padStart(2, "0")}`,
				key: `HASH (${key})`,
				bound: `FOR VALUES WITH (modulus 64, remainder ${i})`,
			});
		const inherited = await client.query<{
			parentCount: number;
			cloneCount: number;
			invalidCount: number;
		}>(
			`with parents as (
			 select t.* from pg_trigger t join pg_class c on c.oid=t.tgrelid
			 join pg_namespace n on n.oid=c.relnamespace
			 where n.nspname='public' and c.relname=$1 and not t.tgisinternal
			), clones as (
			 select t.*, (t.tgname=p.tgname and t.tgfoid=p.tgfoid and t.tgtype=p.tgtype
			 and t.tgenabled='O' and p.tgenabled='O' and t.tgargs=p.tgargs
			 and t.tgattr=p.tgattr and t.tgnargs=p.tgnargs
			 and t.tgdeferrable=p.tgdeferrable and t.tginitdeferred=p.tginitdeferred
			 and t.tgqual::text is not distinct from p.tgqual::text) as matches
			 from pg_trigger t join pg_inherits i on i.inhrelid=t.tgrelid
			 join pg_class c on c.oid=i.inhparent join pg_namespace n on n.oid=c.relnamespace
			 left join parents p on p.oid=t.tgparentid
			 where n.nspname='public' and c.relname=$1 and not t.tgisinternal and t.tgparentid<>0
			) select (select count(*)::int from parents) as "parentCount",
			 count(*)::int as "cloneCount", count(*) filter(where matches is not true)::int as "invalidCount" from clones`,
			[table],
		);
		const row = inherited.rows[0];
		assert.ok(row);
		assert.equal(row.cloneCount, row.parentCount * 64, `${table} is missing inherited triggers`);
		assert.equal(row.invalidCount, 0, `${table} has altered or disabled inherited triggers`);
	}
}
