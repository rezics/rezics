import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import type { Client } from "pg";
import { ContentLanguageRegistryPolicy } from "@rezics/content-language";
import type { Configuration } from "./config";

/** Load only into the fresh run-owned database; retain every native constraint and trigger. */
export async function loadDataset(
	client: Client,
	graphPath: string,
	config: Configuration,
	prepareDefinitions: () => Promise<void>,
) {
	const database = await client.query<{ name: string }>("select current_database() as name");
	if (database.rows[0]?.name !== "rezics_performance")
		throw new Error("Performance loader requires its dedicated database");
	const occupied = await client.query<{ count: string }>(
		"select count(*) from publishing_identity",
	);
	if (occupied.rows[0]?.count !== "0")
		throw new Error("Performance loader requires a fresh database");
	await client.query(`create function pg_temp.perf_id(family integer, ordinal bigint) returns uuid
		language sql immutable parallel safe as $$
		select ('019f0000-' || lpad(to_hex(family),4,'0') || '-7000-8000-' || lpad(to_hex(ordinal),12,'0'))::uuid $$`);
	for (let start = 0; start < config.rows + 4; start += 1000) {
		const stop = Math.min(start + 999, config.rows + 3);
		await client.query(
			`insert into entity_identity(id,shape,status,visibility)
			select pg_temp.perf_id(2,i),'person','published','public' from generate_series($1::bigint,$2::bigint) i`,
			[start, stop],
		);
	}
	await client.query(
		`insert into entity_catalog_profile(id,identity_shape) select id,'person' from entity_identity`,
	);
	await client.query(
		`insert into realm(id,status,visibility,published_at) select pg_temp.perf_id(3,i),'published','public','2026-01-01T00:00:00Z'::timestamptz from generate_series(0,9) i`,
	);
	await client.query(
		`insert into vocabulary_node(id,kind) select pg_temp.perf_id(4,i),'concept' from generate_series(0,99) i`,
	);
	await client.query(
		`insert into tag(id,status,visibility,published_at) select pg_temp.perf_id(4,i),'published','public','2026-01-01T00:00:00Z'::timestamptz from generate_series(0,99) i`,
	);
	await prepareDefinitions();
	for (let start = 0; start < config.rows; start += 1000) {
		const stop = Math.min(start + 999, config.rows - 1);
		await client.query("begin");
		try {
			await client.query(
				`insert into publishing_identity(id,shape,status,visibility,created_at,updated_at)
				select pg_temp.perf_id(1,i),'work','published','public',
				'2026-01-01T00:00:00Z'::timestamptz + ((i/20)::text || ' seconds')::interval,
				'2026-01-01T00:00:00Z'::timestamptz + ((i/20)::text || ' seconds')::interval
				from generate_series($1::bigint,$2::bigint) i`,
				[start, stop],
			);
			await client.query(
				`insert into publishing_work(id,identity_shape) select pg_temp.perf_id(1,i),'work' from generate_series($1::bigint,$2::bigint) i`,
				[start, stop],
			);
			await client.query(
				`insert into publishing_named_form(owner_id,kind,value,language_tag,language_policy,primary_for_language)
				select pg_temp.perf_id(1,i),'title','capacitycommon ' || case when i%1000=0 then 'capacityneedle ' else '' end || i,
				'en',$3,true from generate_series($1::bigint,$2::bigint) i`,
				[start, stop, ContentLanguageRegistryPolicy],
			);
			await client.query(
				`insert into realm_unit(realm_id,unit_id,unit_publishing_id)
				select pg_temp.perf_id(3,case when i%10<8 then 0 else 1+i%9 end),pg_temp.perf_id(1,i),pg_temp.perf_id(1,i)
				from generate_series($1::bigint,$2::bigint) i`,
				[start, stop],
			);
			await client.query(
				`insert into unit_tag(unit_id,unit_publishing_id,tag_id)
				select pg_temp.perf_id(1,i),pg_temp.perf_id(1,i),pg_temp.perf_id(4,case when i%10<8 then 0 else 2+i%98 end)
				from generate_series($1::bigint,$2::bigint) i`,
				[start, stop],
			);
			await client.query(
				`insert into unit_tag(unit_id,unit_publishing_id,tag_id)
				select pg_temp.perf_id(1,i),pg_temp.perf_id(1,i),pg_temp.perf_id(4,1)
				from generate_series($1::bigint,$2::bigint) i where i%1000=0`,
				[start, stop],
			);
			await client.query(
				`insert into credit_attribution(source_unit_id,source_unit_publishing_id,credited_entity_id,role)
				select pg_temp.perf_id(1,i),pg_temp.perf_id(1,i),pg_temp.perf_id(2,0),'author'
				from generate_series($1::bigint,$2::bigint) i where i%10<8`,
				[start, stop],
			);
			await client.query(
				`insert into credit_attribution(source_unit_id,source_unit_publishing_id,credited_entity_id,role)
				select pg_temp.perf_id(1,i),pg_temp.perf_id(1,i),pg_temp.perf_id(2,1),'author'
				from generate_series($1::bigint,$2::bigint) i where i%1000=0`,
				[start, stop],
			);
			await client.query(
				`insert into subject_association(unit_id,unit_publishing_id,entity_id,role)
				select pg_temp.perf_id(1,i),pg_temp.perf_id(1,i),pg_temp.perf_id(2,case when i%10<8 then 0 else 3 end),'about'
				from generate_series($1::bigint,$2::bigint) i`,
				[start, stop],
			);
			await client.query(
				`insert into subject_association(unit_id,unit_publishing_id,entity_id,role)
				select pg_temp.perf_id(1,i),pg_temp.perf_id(1,i),pg_temp.perf_id(2,1),'about'
				from generate_series($1::bigint,$2::bigint) i where i%1000=0`,
				[start, stop],
			);
			await client.query(
				`insert into score(profile_id,unit_id,unit_publishing_id,realm_id,value,visibility)
				select pg_temp.perf_id(2,2+i%100),pg_temp.perf_id(1,i),pg_temp.perf_id(1,i),pg_temp.perf_id(3,case when i%10<8 then 0 else 1+i%9 end),1+(i%10)::integer,'public'
				from generate_series($1::bigint,$2::bigint) i`,
				[start, stop],
			);
			await client.query("commit");
		} catch (error) {
			await client.query("rollback");
			throw error;
		}
	}
	let edges = 0;
	let batch: { source: number; target: number; label: number }[] = [];
	const flush = async () => {
		if (!batch.length) return;
		const serialized = JSON.stringify(batch);
		await client.query(
			`insert into credit_attribution(source_unit_id,source_unit_publishing_id,credited_entity_id,role)
			select pg_temp.perf_id(1,source),pg_temp.perf_id(1,source),pg_temp.perf_id(2,target+4),'author'
			from jsonb_to_recordset($1::jsonb) as edge(source bigint,target bigint,label integer) where label=0
			on conflict (source_unit_id,credited_entity_id,role) do nothing`,
			[serialized],
		);
		await client.query(
			`insert into subject_association(unit_id,unit_publishing_id,entity_id,role)
			select pg_temp.perf_id(1,source),pg_temp.perf_id(1,source),pg_temp.perf_id(2,target+4),'about'
			from jsonb_to_recordset($1::jsonb) as edge(source bigint,target bigint,label integer) where label=1
			on conflict (unit_id,entity_id,role) do nothing`,
			[serialized],
		);
		batch = [];
	};
	for await (const line of createInterface({
		input: createReadStream(graphPath),
		crlfDelay: Infinity,
	})) {
		if (!line.trim()) continue;
		const match = /^(\d+)\s+(\d+)\s+(\d+)\s*\.?$/.exec(line);
		if (!match) throw new Error("Unexpected gMark graph format");
		const [source, label, target] = match.slice(1).map(Number);
		if (source! >= config.rows || target! >= config.rows || ![0, 1].includes(label!))
			throw new Error("gMark edge outside the declared topology");
		batch.push({ source: source!, target: target!, label: label! });
		edges++;
		if (batch.length === 1000) await flush();
	}
	await flush();
	if (!edges) throw new Error("gMark produced no relationships");
	await client.query("analyze");
	const relations = [];
	// Offline fixture accounting, outside the measured online workload. Statistics
	// counters can lag inserts and are not an exact dataset-size receipt.
	for (const table of [
		"publishing_identity",
		"publishing_work",
		"publishing_named_form",
		"entity_identity",
		"credit_attribution",
		"subject_association",
		"realm_unit",
		"unit_tag",
		"unit_effective_tag",
		"score",
	])
		relations.push(
			(
				await client.query(
					`select '${table}' as relation, count(*)::text as rows, pg_total_relation_size('${table}')::text as bytes from ${table}`,
				)
			).rows[0],
		);
	return { graphEdges: edges, relations };
}
