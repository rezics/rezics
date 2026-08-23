import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";

import { adminDatabase, adminDatabaseUrl, applicationDatabaseUrl } from "./admin-database";

declare const postgresqlIdentifierProof: unique symbol;
type PostgreSqlIdentifier = string & { readonly [postgresqlIdentifierProof]: true };

function parsePostgreSqlIdentifier(value: string, source: string): PostgreSqlIdentifier {
	if (!/^[a-z][a-z0-9_]{0,62}$/.test(value)) {
		throw new Error(`${source} must contain a safe PostgreSQL identifier`);
	}
	return value as PostgreSqlIdentifier;
}

function quoteIdentifier(identifier: PostgreSqlIdentifier): string {
	return `"${identifier.replaceAll('"', '""')}"`;
}

const adminUrl = new URL(adminDatabaseUrl);
const adminRole = parsePostgreSqlIdentifier(
	decodeURIComponent(adminUrl.username),
	"DATABASE_ADMIN_URL",
);
const applicationRole = parsePostgreSqlIdentifier(
	decodeURIComponent(new URL(applicationDatabaseUrl).username),
	"DATABASE_URL",
);
const backupDatabaseUrl = process.env.DATABASE_BACKUP_URL;
const backupUrl = backupDatabaseUrl ? new URL(backupDatabaseUrl) : undefined;
const backupDatabaseName = backupUrl
	? parsePostgreSqlIdentifier(
			decodeURIComponent(backupUrl.pathname.slice(1)),
			"DATABASE_BACKUP_URL database name",
		)
	: undefined;
const backupRole = backupUrl
	? parsePostgreSqlIdentifier(decodeURIComponent(backupUrl.username), "DATABASE_BACKUP_URL")
	: undefined;

const pool = adminDatabase.$client;
const client = await pool.connect();
const migrationDatabase = drizzle({ client });

try {
	if (applicationRole !== adminRole) {
		const role = quoteIdentifier(applicationRole);
		await migrationDatabase.transaction(async (transaction) => {
			await transaction.execute(sql.raw(`grant usage on schema public to ${role}`));
			await transaction.execute(sql.raw(`grant usage on schema approx_count to ${role}`));
			await transaction.execute(
				sql.raw(`grant select, insert, update, delete on all tables in schema public to ${role}`),
			);
			await transaction.execute(
				sql.raw(`revoke all privileges on table public.atlas_schema_revisions from ${role}`),
			);
			await transaction.execute(
				sql.raw(`revoke insert, update, delete, truncate on table public.vndb_v11_cutover_control from ${role}`),
			);
			await transaction.execute(
				sql.raw(`grant select on table public.vndb_v11_cutover_control to ${role}`),
			);
			await transaction.execute(
				sql.raw(`grant usage, select on all sequences in schema public to ${role}`),
			);
			await transaction.execute(
				sql.raw(
					`alter default privileges in schema public grant select, insert, update, delete on tables to ${role}`,
				),
			);
			await transaction.execute(
				sql.raw(
					`alter default privileges in schema public grant usage, select on sequences to ${role}`,
				),
			);
			await transaction.execute(
				sql.raw(`revoke execute on all functions in schema approx_count from public, ${role}`),
			);
			await transaction.execute(sql.raw(`grant select on table approx_count.metrics to ${role}`));
			await transaction.execute(
				sql.raw(
					`grant execute on function approx_count.approx_count_info(regclass, interval, boolean) to ${role}`,
				),
			);
			await transaction.execute(sql.raw(`alter role ${role} set approx_count.sample_rate = '0'`));
			await transaction.execute(
				sql.raw(`
					do $privileges$
					declare command_function record;
					begin
						for command_function in
							select function.oid::regprocedure as signature
							from pg_proc function
							join pg_namespace namespace on namespace.oid = function.pronamespace
							where namespace.nspname = 'public'
								and function.proname = 'pgroonga_command'
						loop
							execute format('revoke all on function %s from public, ${role}', command_function.signature);
						end loop;
					end
					$privileges$
				`),
			);
			await transaction.execute(
				sql.raw(
					`grant execute on function public.search_text_candidates(text[],text[],text,bigint,uuid,integer,integer) to ${role}`,
				),
			);
			const privilegeProof = await transaction.execute<
				Record<string, unknown> & {
					readonly canMaintainUnit: boolean;
					readonly canReadApproximateMetrics: boolean;
					readonly canReadEstimate: boolean;
					readonly canRunApproximateWriter: boolean;
					readonly canRunPgroongaCommand: boolean;
					readonly canRunSearchText: boolean;
					readonly canReadCutoverControl: boolean;
					readonly canWriteCutoverControl: boolean;
					readonly canWriteApproximateMetrics: boolean;
				}
			>(sql`
				select
					has_table_privilege(${applicationRole}, 'public.unit', 'MAINTAIN')
						as "canMaintainUnit",
					has_table_privilege(${applicationRole}, 'approx_count.metrics', 'SELECT')
						as "canReadApproximateMetrics",
					has_function_privilege(
						${applicationRole},
						'approx_count.approx_count_info(regclass,interval,boolean)',
						'EXECUTE'
					) as "canReadEstimate",
					has_function_privilege(
						${applicationRole},
						'approx_count.approx_count(regclass,interval,boolean)',
						'EXECUTE'
					) as "canRunApproximateWriter",
					exists (
						select 1
						from pg_proc function
						join pg_namespace namespace on namespace.oid = function.pronamespace
						where namespace.nspname = 'public'
							and function.proname = 'pgroonga_command'
							and has_function_privilege(${applicationRole}, function.oid, 'EXECUTE')
					) as "canRunPgroongaCommand",
					has_function_privilege(
						${applicationRole},
						'public.search_text_candidates(text[],text[],text,bigint,uuid,integer,integer)',
						'EXECUTE'
					) as "canRunSearchText",
					has_table_privilege(
						${applicationRole}, 'public.vndb_v11_cutover_control', 'SELECT'
					) as "canReadCutoverControl",
					(
						has_table_privilege(${applicationRole}, 'public.vndb_v11_cutover_control', 'INSERT')
						or has_table_privilege(${applicationRole}, 'public.vndb_v11_cutover_control', 'UPDATE')
						or has_table_privilege(${applicationRole}, 'public.vndb_v11_cutover_control', 'DELETE')
						or has_table_privilege(${applicationRole}, 'public.vndb_v11_cutover_control', 'TRUNCATE')
					) as "canWriteCutoverControl",
					has_table_privilege(
						${applicationRole},
						'approx_count.metrics',
						'INSERT,UPDATE,DELETE,TRUNCATE'
					) as "canWriteApproximateMetrics"
			`);
			const proof = privilegeProof.rows[0];
			if (
				!proof?.canReadEstimate ||
				!proof.canReadApproximateMetrics ||
				!proof.canReadCutoverControl ||
				!proof.canRunSearchText ||
				proof.canMaintainUnit ||
				proof.canRunApproximateWriter ||
				proof.canRunPgroongaCommand ||
				proof.canWriteCutoverControl ||
				proof.canWriteApproximateMetrics
			)
				throw new Error("Application database privilege proof failed");
		});
	}
	if (backupRole) {
		if (!backupUrl || !backupDatabaseName)
			throw new Error("Database backup connection proof is missing");
		if (
			backupUrl.protocol !== adminUrl.protocol ||
			backupUrl.host !== adminUrl.host ||
			backupUrl.pathname !== adminUrl.pathname
		)
			throw new Error("Database backup and admin URLs must address the same database");
		if (backupRole === adminRole || backupRole === applicationRole)
			throw new Error("Database backup role must be distinct from admin and application roles");
		const role = quoteIdentifier(backupRole);
		await migrationDatabase.transaction(async (transaction) => {
			await transaction.execute(
				sql.raw(`grant connect on database ${quoteIdentifier(backupDatabaseName)} to ${role}`),
			);
			await transaction.execute(sql.raw(`grant usage on schema public to ${role}`));
			await transaction.execute(sql.raw(`grant usage on schema approx_count to ${role}`));
			await transaction.execute(
				sql.raw(`revoke all privileges on all tables in schema public from ${role}`),
			);
			await transaction.execute(sql.raw(`grant select on all tables in schema public to ${role}`));
			await transaction.execute(
				sql.raw(`grant select on all sequences in schema public to ${role}`),
			);
			await transaction.execute(
				sql.raw(`grant select on all tables in schema approx_count to ${role}`),
			);
			await transaction.execute(
				sql.raw(`alter default privileges in schema public grant select on tables to ${role}`),
			);
			await transaction.execute(
				sql.raw(`alter default privileges in schema public grant select on sequences to ${role}`),
			);
			const privilegeProof = await transaction.execute<
				Record<string, unknown> & {
					readonly canReadUnit: boolean;
					readonly canWriteUnit: boolean;
				}
			>(sql`
				select
					has_table_privilege(${backupRole}, 'public.unit', 'SELECT')
						as "canReadUnit",
					(
						has_table_privilege(${backupRole}, 'public.unit', 'INSERT')
						or has_table_privilege(${backupRole}, 'public.unit', 'UPDATE')
						or has_table_privilege(${backupRole}, 'public.unit', 'DELETE')
						or has_table_privilege(${backupRole}, 'public.unit', 'TRUNCATE')
					) as "canWriteUnit"
			`);
			const proof = privilegeProof.rows[0];
			if (!proof?.canReadUnit || proof.canWriteUnit)
				throw new Error("Databasus read-only database privilege proof failed");
		});
	}
} finally {
	client.release();
	await pool.end();
}
