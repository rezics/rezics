import assert from "node:assert/strict";
import { Pool } from "pg";
import { z } from "zod";
import { catalogSourceRecordId } from "../src/services/catalog/source-record-key";

const connectionString = process.env.DATABASE_URL;
if (!connectionString || process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE !== "1")
	throw new Error("Explicit disposable-fixture configuration is required");
const target = new URL(connectionString);
if (
	!["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) ||
	!/^\/rezics_atlas(?:_[a-z0-9_]+)?$/.test(target.pathname)
)
	throw new Error("Capacity acceptance requires an isolated rezics_atlas database");
const pool = new Pool({ connectionString, max: 1, statement_timeout: 60000 });
const client = await pool.connect();
const uuidRow = z.object({ id: z.uuid() });
try {
	await client.query("begin");
	await client.query(
		"create temporary table context_capacity_owners(id uuid primary key, position integer not null) on commit drop",
	);
	await client.query(
		"create temporary table context_capacity_keys(content_id uuid not null, id uuid primary key) on commit drop",
	);
	const actor = uuidRow.parse(
		(
			await client.query(
				"insert into users(name,email) values ('Context capacity fixture',$1) returning id",
				[`${crypto.randomUUID()}@example.invalid`],
			)
		).rows[0],
	).id;
	await client.query(
		"insert into context_capacity_owners select uuidv7(), position from generate_series(0,63) position",
	);
	await client.query(
		"insert into software_identity(id,shape,created_by_auth_user_id) select id,'content',$1::uuid from context_capacity_owners",
		[actor],
	);
	await client.query("insert into software_content(id) select id from context_capacity_owners");
	await client.query(
		"insert into context_capacity_keys select owner.id,uuidv7() from context_capacity_owners owner cross join lateral generate_series(1,case when position = 0 then 10000 else 32 end) n",
	);
	await client.query(
		"insert into software_participation_context(content_id,id) select content_id,id from context_capacity_keys",
	);
	for (const revision of [1, 2, 3]) {
		await client.query(
			"insert into software_participation_context_revision(content_id,context_id,revision,label,language_tag,state,created_by_auth_user_id) select content_id,id,$1,'Participation context','en','active',$2::uuid from context_capacity_keys",
			[revision, actor],
		);
		await client.query(
			"update software_participation_context context set current_revision = $1 from context_capacity_keys fixture where context.content_id = fixture.content_id and context.id = fixture.id",
			[revision],
		);
	}
	await client.query("alter table context_capacity_keys add column source_id uuid");
	const sourceKeys = z
		.array(uuidRow)
		.max(12016)
		.parse((await client.query("select id from context_capacity_keys")).rows)
		.map(({ id }) => ({
			id,
			source_id: catalogSourceRecordId({
				source: "context-capacity",
				objectType: "vn",
				externalId: id,
			}),
		}));
	await client.query(
		"update context_capacity_keys fixture set source_id = value.source_id from jsonb_to_recordset($1::jsonb) as value(id uuid,source_id uuid) where fixture.id = value.id",
		[JSON.stringify(sourceKeys)],
	);
	await client.query(
		"insert into catalog_source_record(id,source,object_type,external_id) select source_id,'context-capacity','vn',id::text from context_capacity_keys",
	);
	await client.query(
		"insert into catalog_source_snapshot(source_record_id,content_sha256,contract_sha256,payload_ref) select source_id,repeat('a',64),repeat('b',64),'fixture:context-capacity:' || n from context_capacity_keys cross join generate_series(1,2) n",
	);
	await client.query(
		"insert into software_participation_source_occurrence(source_record_id,snapshot_id,namespace,local_key,content_id,context_id,context_revision,source_pointer,source_label,source_language,source_language_tag,source_claimed_official) select snapshot.source_record_id,snapshot.id,'editions','0',fixture.content_id,fixture.id,1,'/editions/0','Participation context','en','en',false from catalog_source_snapshot snapshot join context_capacity_keys fixture on fixture.source_id = snapshot.source_record_id",
	);
	await client.query("set constraints all immediate");
	await client.query("analyze software_participation_context");
	await client.query("analyze software_participation_context_revision");
	await client.query("analyze software_participation_source_occurrence");
	const key = z
		.object({ content_id: z.uuid(), id: z.uuid(), source_id: z.uuid() })
		.parse(
			(
				await client.query(
					"select fixture.* from context_capacity_keys fixture join context_capacity_owners owner on owner.id = fixture.content_id where owner.position = 0 order by fixture.id limit 1",
				)
			).rows[0],
		);
	const snapshot = uuidRow.parse(
		(
			await client.query(
				"select id from catalog_source_snapshot where source_record_id = $1 order by id limit 1",
				[key.source_id],
			)
		).rows[0],
	);
	const queries = [
		{
			name: "current-head",
			query:
				"select revision.* from software_participation_context context join software_participation_context_revision revision on revision.content_id = context.content_id and revision.context_id = context.id and revision.revision = context.current_revision where context.content_id = $1 and context.id = $2",
			params: [key.content_id, key.id],
		},
		{
			name: "history-keyset",
			query:
				"select * from software_participation_context_revision where content_id = $1 and context_id = $2 and revision > 1 order by revision limit 100",
			params: [key.content_id, key.id],
		},
		{
			name: "exact-source-occurrence",
			query:
				"select * from software_participation_source_occurrence where source_record_id = $1 and snapshot_id = $2 and namespace = 'editions' and local_key = '0'",
			params: [key.source_id, snapshot.id],
		},
		{
			name: "context-source-reverse",
			query:
				"select * from software_participation_source_occurrence where content_id = $1 and context_id = $2 and context_revision = 1 order by source_record_id,snapshot_id limit 100",
			params: [key.content_id, key.id],
		},
	];
	for (const query of queries) {
		const result = await client.query(
			`explain (analyze,buffers,format json) ${query.query}`,
			query.params,
		);
		const encoded = JSON.stringify(result.rows);
		assert.ok(
			!encoded.includes('"Node Type":"Seq Scan"'),
			`${query.name} unexpectedly scanned a whole corpus relation`,
		);
		console.info(`${query.name}: ${encoded}`);
	}
	const sizes = await client.query(
		"select relname,pg_relation_size(relid)::text heap_bytes,pg_indexes_size(relid)::text index_bytes from pg_stat_user_tables where relname in ('software_participation_context','software_participation_context_revision','software_participation_source_occurrence') order by relname",
	);
	console.info(
		"Skew fixture: 64 owners, 10,000 contexts on one hot owner, 32 on each other owner; 12,016 contexts, 36,048 revisions, 24,032 exact observations.",
		sizes.rows,
	);
	const measuredRows = z
		.array(
			z.object({
				heap_bytes: z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
				index_bytes: z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
			}),
		)
		.parse(sizes.rows);
	const allocatedBytes = measuredRows.reduce(
		(total, row) => total + row.heap_bytes + row.index_bytes,
		0,
	);
	const allocatedBytesPerContext = allocatedBytes / 12016;
	console.info(
		"Allocated relation bytes/context including head-update churn and any pre-existing fixture pages:",
		allocatedBytesPerContext,
		"; naive 500M/3B extrapolation (TB):",
		(allocatedBytesPerContext * 500000000) / 1e12,
		(allocatedBytesPerContext * 3000000000) / 1e12,
	);
	console.info(
		"Nominal premeasurement arithmetic was 832GB/4.992TB at500M/3B (192-byte header +3x256-byte revision +2x352-byte occurrence). Compare actual allocations above before accepting those assumptions. Neither is target-scale throughput evidence; TOAST, WAL, replicas, vacuum, retained history and production routing need separate qualification. Leading owner/source keys preserve an owner-routed cutover path.",
	);
} finally {
	await client.query("rollback");
	client.release();
	await pool.end();
}
