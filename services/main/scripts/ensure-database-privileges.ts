import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";

import { adminDatabase, adminDatabaseUrl, applicationDatabaseUrl } from "./admin-database";

declare const postgresqlRoleNameProof: unique symbol;
type PostgreSqlRoleName = string & { readonly [postgresqlRoleNameProof]: true };

function parsePostgreSqlRoleName(value: string, source: string): PostgreSqlRoleName {
	if (!/^[a-z][a-z0-9_]{0,62}$/.test(value)) {
		throw new Error(`${source} must contain a safe PostgreSQL role name`);
	}
	return value as PostgreSqlRoleName;
}

function quoteRole(role: PostgreSqlRoleName): string {
	return `"${role.replaceAll('"', '""')}"`;
}

const adminRole = parsePostgreSqlRoleName(
	decodeURIComponent(new URL(adminDatabaseUrl).username),
	"DATABASE_ADMIN_URL",
);
const applicationRole = parsePostgreSqlRoleName(
	decodeURIComponent(new URL(applicationDatabaseUrl).username),
	"DATABASE_URL",
);

const pool = adminDatabase.$client;
const client = await pool.connect();
const migrationDatabase = drizzle({ client });

try {
	if (applicationRole !== adminRole) {
		const role = quoteRole(applicationRole);
		await migrationDatabase.transaction(async (transaction) => {
			await transaction.execute(sql.raw(`grant usage on schema public to ${role}`));
			await transaction.execute(sql.raw(`grant usage on schema approx_count to ${role}`));
			await transaction.execute(
				sql.raw(
					`grant select, insert, update, delete on all tables in schema public to ${role}`,
				),
			);
			await transaction.execute(
				sql.raw(
					`revoke all privileges on table public.atlas_schema_revisions from ${role}`,
				),
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
				sql.raw(
					`revoke execute on all functions in schema approx_count from public, ${role}`,
				),
			);
			await transaction.execute(
				sql.raw(`grant select on table approx_count.metrics to ${role}`),
			);
			await transaction.execute(
				sql.raw(
					`grant execute on function approx_count.approx_count_info(regclass, interval, boolean) to ${role}`,
				),
			);
			await transaction.execute(
				sql.raw(`alter role ${role} set approx_count.sample_rate = '0'`),
			);
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
			const privilegeProof = await transaction.execute<
				Record<string, unknown> & {
					readonly canMaintainUnit: boolean;
					readonly canReadApproximateMetrics: boolean;
					readonly canReadEstimate: boolean;
					readonly canRunApproximateWriter: boolean;
					readonly canRunPgroongaCommand: boolean;
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
				proof.canMaintainUnit ||
				proof.canRunApproximateWriter ||
				proof.canRunPgroongaCommand ||
				proof.canWriteApproximateMetrics
			)
				throw new Error("Application database privilege proof failed");
		});
	}
} finally {
	client.release();
	await pool.end();
}
