import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { CatalogOwnerValues } from "@rezics/reference";
import {
	allocateRevisionReference,
	resolveRevisionReference,
} from "../src/services/units/revision-reference";
import { RevisionReferenceKindValues } from "@rezics/schema/contracts/native/revision-reference";

function isCode(error: unknown, code: string) {
	const cause = error instanceof Error && "cause" in error ? error.cause : error;
	return cause instanceof Error && "code" in cause && cause.code === code;
}

/** Run exact-key persistence cases in the owning disposable reference fixture. @internal */
export async function checkRevisionReferences(
	first: Client,
	second: Client,
	waitForBlock: () => Promise<void>,
) {
	const firstDb = drizzle({ client: first });
	const secondDb = drizzle({ client: second });
	const rejected = (query: string, params: unknown[], code: string) =>
		assert.rejects(
			first.query(query, params),
			(error: unknown) => isCode(error, code),
			`Expected ${code}: ${query}`,
		);
	await first.query("select id from public.revision_reference limit 0");

	for (const owner of CatalogOwnerValues) {
		const ownerId = randomUUID();
		await first.query(`insert into public.${owner}_identity (id, shape) values ($1, 'unknown')`, [
			ownerId,
		]);
		assert.equal(
			(
				await first.query(`select id from public.reference_value where target_${owner}_id = $1`, [
					ownerId,
				])
			).rowCount,
			0,
		);
		for (const kind of RevisionReferenceKindValues) {
			const itemId = randomUUID();
			if (kind === "named_form")
				await first.query(
					`insert into public.${owner}_named_form (owner_id, id, kind, value) values ($1, $2, 'title', 'Original name')`,
					[ownerId, itemId],
				);
			else
				await first.query(
					`insert into public.${owner}_identifier_claim (owner_id, id, namespace, value, normalized_value) values ($1, $2, 'fixture', 'id-1', 'id-1')`,
					[ownerId, itemId],
				);
			const target = { owner, kind, ownerId, itemId, revision: 1 };
			const id = await firstDb.transaction((tx) => allocateRevisionReference(tx, target));
			assert.deepEqual(await firstDb.transaction((tx) => resolveRevisionReference(tx, id)), target);
			assert.equal(await firstDb.transaction((tx) => allocateRevisionReference(tx, target)), id);
			await rejected(
				`insert into public.revision_reference (${owner}_${kind}_owner_id, ${owner}_${kind}_item_id, ${owner}_${kind}_revision) values ($1, $2, 1)`,
				[randomUUID(), randomUUID()],
				"23503",
			);
		}
	}

	const parent = randomUUID(),
		otherParent = randomUUID(),
		item = randomUUID(),
		onlyHere = randomUUID();
	await first.query(
		"insert into public.reference_identity (id, shape) values ($1, 'unknown'), ($2, 'unknown')",
		[parent, otherParent],
	);
	// Item UUIDs are owner-local: deliberately reuse one under two parents.
	await first.query(
		`insert into public.reference_named_form (owner_id, id, kind, value)
		values ($1, $3, 'title', 'First parent'), ($2, $3, 'title', 'Second parent'), ($1, $4, 'alternate', 'Only first')`,
		[parent, otherParent, item, onlyHere],
	);
	const target = {
		owner: "reference",
		kind: "named_form",
		ownerId: parent,
		itemId: item,
		revision: 1,
	} as const;
	const oldId = await firstDb.transaction((tx) => allocateRevisionReference(tx, target));
	const otherId = await firstDb.transaction((tx) =>
		allocateRevisionReference(tx, { ...target, ownerId: otherParent }),
	);
	assert.notEqual(oldId, otherId);
	assert.deepEqual(await firstDb.transaction((tx) => resolveRevisionReference(tx, otherId)), {
		...target,
		ownerId: otherParent,
	});
	for (const invalid of [
		{ ...target, itemId: onlyHere, ownerId: otherParent },
		{ ...target, owner: "publishing" as const },
		{ ...target, revision: 99 },
		{ ...target, kind: "identifier_claim" as const },
	])
		await assert.rejects(
			firstDb.transaction((tx) => allocateRevisionReference(tx, invalid)),
			(error: unknown) => isCode(error, "23503"),
		);
	assert.equal(await firstDb.transaction((tx) => resolveRevisionReference(tx, randomUUID())), null);

	await first.query(
		"update public.reference_named_form set value = 'Updated first', revision = 2 where owner_id = $1 and id = $2",
		[parent, item],
	);
	const newId = await firstDb.transaction((tx) =>
		allocateRevisionReference(tx, { ...target, revision: 2 }),
	);
	assert.notEqual(oldId, newId);
	assert.deepEqual(await firstDb.transaction((tx) => resolveRevisionReference(tx, oldId)), target);
	assert.deepEqual(
		(
			await first.query(
				"select revision::integer, value from public.reference_named_form_revision where owner_id = $1 and id = $2 order by revision",
				[parent, item],
			)
		).rows,
		[
			{ revision: 1, value: "First parent" },
			{ revision: 2, value: "Updated first" },
		],
	);

	await rejected("insert into public.revision_reference default values", [], "23514");
	for (const revision of ["0", "-1", "9007199254740992"])
		await rejected(
			"insert into public.revision_reference (reference_named_form_owner_id, reference_named_form_item_id, reference_named_form_revision) values ($1, $2, $3)",
			[parent, item, revision],
			"23514",
		);
	const parts = [
		{ name: "reference_named_form_owner_id", value: parent },
		{ name: "reference_named_form_item_id", value: item },
		{ name: "reference_named_form_revision", value: 1 },
	] as const;
	for (let mask = 1; mask < 7; mask++) {
		const selected = parts.filter((_, index) => mask & (1 << index));
		await rejected(
			`insert into public.revision_reference (${selected.map((field) => field.name).join(", ")}) values (${selected.map((_, index) => `$${index + 1}`).join(", ")})`,
			selected.map((field) => field.value),
			"23514",
		);
	}
	await rejected(
		"insert into public.revision_reference (reference_named_form_owner_id, publishing_named_form_owner_id, music_named_form_owner_id) values ($1, $1, $1)",
		[parent],
		"23514",
	);
	await rejected(
		`insert into public.revision_reference (reference_named_form_owner_id, reference_named_form_item_id, reference_named_form_revision, reference_identifier_claim_owner_id, reference_identifier_claim_item_id, reference_identifier_claim_revision)
		values ($1, $2, 1, $1, $2, 1)`,
		[parent, item],
		"23514",
	);
	await rejected(
		"insert into public.revision_reference (reference_named_form_owner_id, reference_named_form_item_id, reference_named_form_revision) values ($1, $2, 1)",
		[parent, item],
		"23505",
	);
	await rejected(
		"update public.revision_reference set reference_named_form_revision = 2 where id = $1",
		[oldId],
		"55000",
	);
	await rejected(
		"update public.revision_reference set reference_named_form_owner_id = $2 where id = $1",
		[oldId, otherParent],
		"55000",
	);
	await rejected(
		"update public.revision_reference set id = $2 where id = $1",
		[oldId, randomUUID()],
		"55000",
	);
	await rejected("delete from public.revision_reference where id = $1", [oldId], "55000");
	await rejected(
		"delete from public.reference_named_form_revision where owner_id = $1 and id = $2 and revision = 1",
		[parent, item],
		"23514",
	);

	for (const [revision, outcome] of [
		[3, "commit"],
		[4, "rollback"],
	] as const) {
		await first.query(
			"update public.reference_named_form set revision = $3::bigint, value = 'Revision ' || ($3::bigint)::text where owner_id = $1 and id = $2",
			[parent, item, revision],
		);
		await first.query("begin");
		const provisional = randomUUID();
		await first.query(
			"insert into public.revision_reference (id, reference_named_form_owner_id, reference_named_form_item_id, reference_named_form_revision) values ($1, $2, $3, $4)",
			[provisional, parent, item, revision],
		);
		const pending = secondDb
			.transaction((tx) => allocateRevisionReference(tx, { ...target, revision }))
			.then(
				(value) => ({ value }),
				(error: unknown) => ({ error }),
			);
		try {
			await waitForBlock();
		} finally {
			await first.query(outcome);
		}
		const completed = await pending;
		if ("error" in completed) throw completed.error;
		if (outcome === "commit") assert.equal(completed.value, provisional);
		else assert.notEqual(completed.value, provisional);
	}
	await first.query(
		"update public.reference_named_form set revision = 5, value = 'Revision 5' where owner_id = $1 and id = $2",
		[parent, item],
	);
	await first.query("begin");
	const serialId = randomUUID();
	await first.query(
		"insert into public.revision_reference (id, reference_named_form_owner_id, reference_named_form_item_id, reference_named_form_revision) values ($1, $2, $3, 5)",
		[serialId, parent, item],
	);
	const serialized = assert.rejects(
		secondDb.transaction((tx) => allocateRevisionReference(tx, { ...target, revision: 5 }), {
			isolationLevel: "repeatable read",
		}),
		(error: unknown) => isCode(error, "40001"),
	);
	try {
		await waitForBlock();
	} finally {
		await first.query("commit");
	}
	await serialized;
	assert.equal(
		await secondDb.transaction((tx) => allocateRevisionReference(tx, { ...target, revision: 5 })),
		serialId,
	);

	for (let start = 1; start <= 10000; start += 500) {
		await first.query(
			`insert into public.reference_named_form (owner_id, id, kind, value)
			select $1::uuid, overlay(overlay(md5('revision-reference-20260911:' || i) placing '8' from 13 for 1) placing '8' from 17 for 1)::uuid, 'alternate', 'Fixture name ' || i
			from generate_series($2::integer, $3::integer) i`,
			[parent, start, start + 499],
		);
		await first.query(
			`insert into public.revision_reference (reference_named_form_owner_id, reference_named_form_item_id, reference_named_form_revision)
			select $1::uuid, overlay(overlay(md5('revision-reference-20260911:' || i) placing '8' from 13 for 1) placing '8' from 17 for 1)::uuid, 1
			from generate_series($2::integer, $3::integer) i`,
			[parent, start, start + 499],
		);
	}
	const [sampleReference] = (
		await first.query<{ id: string; itemId: string }>(
			`select id, reference_named_form_item_id as "itemId" from public.revision_reference
		where reference_named_form_owner_id = $1 and reference_named_form_item_id = overlay(overlay(md5('revision-reference-20260911:' || 1) placing '8' from 13 for 1) placing '8' from 17 for 1)::uuid and reference_named_form_revision = 1`,
			[parent],
		)
	).rows;
	assert(sampleReference);
	assert.deepEqual(
		await firstDb.transaction((tx) => resolveRevisionReference(tx, sampleReference.id)),
		{ ...target, itemId: sampleReference.itemId },
	);
	await first.query("analyze public.revision_reference");
	const plan = await first.query(
		`explain (analyze, buffers, format json) select id from public.revision_reference
		where reference_named_form_owner_id = $1 and reference_named_form_item_id = $2 and reference_named_form_revision = 1 limit 1`,
		[parent, item],
	);
	assert.match(JSON.stringify(plan.rows), /revision_reference_reference_named_form_key/u);
	const footprint =
		await first.query(`select count(*)::integer as rows, avg(pg_column_size(v))::numeric(10,2) as tuple_bytes,
		pg_table_size('public.revision_reference') as heap_bytes, pg_indexes_size('public.revision_reference') as index_bytes from public.revision_reference v`);
	return { sample: footprint.rows[0], targetPlan: plan.rows };
}
