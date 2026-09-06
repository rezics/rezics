import { createHash } from "node:crypto";
import { z } from "zod";

const RelationLimit = 20_000;
const TextNumber = z.string().regex(/^\d+$/);
const Table = z.object({
	name: z.string(),
	kind: z.enum(["r", "p"]),
	estimatedRows: z.string().nullable(),
	heapBytes: TextNumber,
	totalBytes: TextNumber,
	lastAnalyze: z.string().nullable(),
});
const Column = z.object({
	table: z.string(),
	name: z.string(),
	type: z.string(),
	nullable: z.boolean(),
});
const ForeignKey = z.object({
	name: z.string(),
	sourceTable: z.string(),
	sourceColumns: z.array(z.string()),
	targetSchema: z.string(),
	targetTable: z.string(),
	targetColumns: z.array(z.string()),
	definition: z.string(),
	validated: z.boolean(),
});
const Index = z.object({
	table: z.string(),
	name: z.string(),
	definition: z.string(),
	valid: z.boolean(),
	ready: z.boolean(),
	bytes: TextNumber,
});
const Extension = z.object({ name: z.string(), version: z.string() });
const Setting = z.object({ name: z.string(), value: z.string(), unit: z.string().nullable() });

/**
 * Capture bounded schema/runtime metadata without reading application rows or secret settings.
 * @internal
 */
export async function captureDatabaseInventory(
	client: { query(text: string, values?: unknown[]): Promise<{ rows: unknown[] }> },
	scope: "local" | "production",
) {
	await client.query("begin isolation level repeatable read read only");
	try {
		await client.query("set local statement_timeout = '10s'");
		await client.query("set local lock_timeout = '1s'");
		await client.query("set local transaction_timeout = '30s'");
		const tables = z
			.array(Table)
			.max(RelationLimit)
			.parse(
				(
					await client.query(`
			select c.relname as name, c.relkind::text as kind,
				case when c.reltuples < 0 then null else c.reltuples::bigint::text end as "estimatedRows",
				pg_relation_size(c.oid)::text as "heapBytes", pg_total_relation_size(c.oid)::text as "totalBytes",
				greatest(s.last_analyze, s.last_autoanalyze)::text as "lastAnalyze"
			from pg_class c join pg_namespace n on n.oid = c.relnamespace
			left join pg_stat_all_tables s on s.relid = c.oid
			where n.nspname = 'public' and c.relkind in ('r', 'p')
			order by c.relname limit ${RelationLimit + 1}`)
				).rows,
			);
		const columns = z
			.array(Column)
			.max(RelationLimit * 100)
			.parse(
				(
					await client.query(`
			select c.relname as "table", a.attname as name, format_type(a.atttypid, a.atttypmod) as type,
				not a.attnotnull as nullable
			from pg_attribute a join pg_class c on c.oid = a.attrelid
			join pg_namespace n on n.oid = c.relnamespace
			where n.nspname = 'public' and c.relkind in ('r', 'p') and a.attnum > 0 and not a.attisdropped
			order by c.relname, a.attnum limit ${RelationLimit * 100 + 1}`)
				).rows,
			);
		const foreignKeys = z
			.array(ForeignKey)
			.max(RelationLimit * 20)
			.parse(
				(
					await client.query(`
			select con.conname as name, c.relname as "sourceTable",
				array(select a.attname::text from unnest(con.conkey) with ordinality k(attnum, ord)
					join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.attnum order by k.ord) as "sourceColumns",
				tn.nspname as "targetSchema", tc.relname as "targetTable",
				array(select a.attname::text from unnest(con.confkey) with ordinality k(attnum, ord)
					join pg_attribute a on a.attrelid = con.confrelid and a.attnum = k.attnum order by k.ord) as "targetColumns",
				pg_get_constraintdef(con.oid) as definition, con.convalidated as validated
			from pg_constraint con join pg_class c on c.oid = con.conrelid
			join pg_namespace n on n.oid = c.relnamespace
			join pg_class tc on tc.oid = con.confrelid join pg_namespace tn on tn.oid = tc.relnamespace
			where con.contype = 'f' and n.nspname = 'public'
			order by c.relname, con.conname limit ${RelationLimit * 20 + 1}`)
				).rows,
			);
		const indexes = z
			.array(Index)
			.max(RelationLimit * 20)
			.parse(
				(
					await client.query(`
			select t.relname as "table", c.relname as name, pg_get_indexdef(c.oid) as definition,
				i.indisvalid as valid, i.indisready as ready, pg_relation_size(c.oid)::text as bytes
			from pg_index i join pg_class c on c.oid = i.indexrelid
			join pg_class t on t.oid = i.indrelid join pg_namespace n on n.oid = t.relnamespace
			where n.nspname = 'public' order by t.relname, c.relname limit ${RelationLimit * 20 + 1}`)
				).rows,
			);
		const extensions = z
			.array(Extension)
			.max(1_000)
			.parse(
				(
					await client.query(
						"select extname as name, extversion as version from pg_extension order by extname limit 1001",
					)
				).rows,
			);
		const settings = z.array(Setting).parse(
			(
				await client.query(
					`
			select name, setting as value, unit from pg_settings
			where name = any($1::text[]) order by name`,
					[
						[
							"server_version",
							"server_version_num",
							"block_size",
							"max_connections",
							"reserved_connections",
							"superuser_reserved_connections",
							"max_worker_processes",
							"shared_preload_libraries",
							"wal_level",
							"archive_mode",
							"archive_timeout",
							"max_wal_size",
							"wal_segment_size",
							"shared_buffers",
							"pgroonga.enable_wal_resource_manager",
							"pgroonga.enable_wal",
							"pgroonga.enable_crash_safe",
						],
					],
				)
			).rows,
		);
		// Only the Atlas ledger is read; descriptions/SQL/errors and application rows are excluded.
		const migrations = tables.some((table) => table.name === "atlas_schema_revisions")
			? z
					.array(z.object({ version: z.string(), applied: TextNumber, total: TextNumber }))
					.max(10_000)
					.parse(
						(
							await client.query(
								"select version, applied::text, total::text from public.atlas_schema_revisions order by version limit 10001",
							)
						).rows,
					)
			: [];
		const structure = {
			columns,
			foreignKeys,
			indexes: indexes.map(({ bytes: _bytes, ...index }) => index),
		};
		return {
			format: "rezics.database-inventory.v1",
			scope,
			capturedAt: new Date().toISOString(),
			referenceContractSha256: createHash("sha256").update(JSON.stringify(structure)).digest("hex"),
			tables,
			columns,
			foreignKeys,
			indexes,
			extensions,
			settings,
			migrations,
			participationReferences: foreignKeys.filter(
				(key) => key.targetSchema === "public" && ["profile", "users"].includes(key.targetTable),
			),
			evidence: {
				applicationRowsRead: false,
				exactCounts: false,
				recoverableBackupVerified: false,
				productionReleaseVerified: false,
				estimatesMayBeStale: true,
			},
		};
	} finally {
		await client.query("rollback");
	}
}
