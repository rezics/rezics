import assert from "node:assert/strict";
import { and, eq, gt, sql } from "drizzle-orm";
import type { DatabaseTransaction } from "../src/services/database";
import { accountFavorite } from "../src/services/database/schema/favorites";
import { referenceValue } from "../src/services/database/schema/reference-value";
import { referenceValueTarget } from "../src/services/units/reference-value";

/** Bounded hot-account sample, rolled back by the owning lifecycle fixture. */
export async function checkFavoriteQueryPlans(tx: DatabaseTransaction, authUserId: string) {
	const prefix = `favorite-plan:${authUserId}:`;
	const id = sql`overlay(overlay(md5(${prefix} || i) placing '8' from 13 for 1) placing '8' from 17 for 1)::uuid`;
	for (let start = 1; start <= 2000; start += 100) {
		await tx.execute(sql`insert into public.reference_identity(id, shape)
			select ${id}, 'unknown' from generate_series(${start}::integer, ${start + 99}::integer) i`);
		await tx.execute(sql`insert into public.reference_value(target_reference_id)
			select ${id} from generate_series(${start}::integer, ${start + 99}::integer) i`);
		await tx.execute(sql`insert into public.account_favorite(auth_user_id, target_reference_id, position, note, snapshot, revision)
			select ${authUserId}::uuid, r.id, 'a1' || lpad(i::text, 5, '0') || 'V', repeat('n', 100),
				jsonb_build_object('title', repeat('t', 200), 'summary', repeat('s', 700), 'language', 'en', 'capturedAt', '2026-09-11T00:00:00.000Z'), 1
			from generate_series(${start}::integer, ${start + 99}::integer) i
			join public.reference_value r on r.target_reference_id = ${id}`);
	}
	await tx.execute(sql`analyze public.account_favorite, public.reference_value`);
	const query = tx
		.select({ entry: accountFavorite, target: referenceValueTarget })
		.from(accountFavorite)
		.innerJoin(referenceValue, eq(referenceValue.id, accountFavorite.targetReferenceId))
		.where(
			and(eq(accountFavorite.authUserId, authUserId), gt(accountFavorite.position, "a100999V")),
		)
		.orderBy(accountFavorite.position)
		.limit(31);
	const page = await tx.execute(sql`explain (analyze, buffers, format json) ${query.getSQL()}`);
	const rendered = JSON.stringify(page.rows);
	assert.match(rendered, /account_favorite_position_key/u);
	assert.match(rendered, /reference_value_pkey/u);
	assert.doesNotMatch(rendered, /Seq Scan/u);
	const footprint = await tx.execute(sql`select count(*)::integer as rows,
		avg(pg_column_size(f))::numeric(10,2) as tuple_bytes,
		pg_table_size('public.account_favorite') as heap_bytes,
		pg_indexes_size('public.account_favorite') as index_bytes
		from public.account_favorite f where auth_user_id = ${authUserId}::uuid`);
	assert.equal(footprint.rows[0]?.rows, 2000);
	return { sample: footprint.rows[0], orderedPage: page.rows };
}
