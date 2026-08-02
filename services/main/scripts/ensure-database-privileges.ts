import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";

import { adminDatabase, adminDatabaseUrl, applicationDatabaseUrl } from "./admin-database";
import { sequinSearchEnrichmentRelations } from "./search-enrichment-relations";

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

function quoteStaticRelation(relation: string): string {
	if (!/^[a-z][a-z0-9_]{0,62}$/.test(relation)) {
		throw new Error(`Invalid static PostgreSQL relation: ${relation}`);
	}
	return `"public"."${relation}"`;
}

const adminRole = parsePostgreSqlRoleName(
	decodeURIComponent(new URL(adminDatabaseUrl).username),
	"DATABASE_ADMIN_URL",
);
const applicationRole = parsePostgreSqlRoleName(
	decodeURIComponent(new URL(applicationDatabaseUrl).username),
	"DATABASE_URL",
);
const replicationRole = parsePostgreSqlRoleName(
	process.env.SEQUIN_SOURCE_USERNAME ?? "",
	"SEQUIN_SOURCE_USERNAME",
);
const sequinReadableRelations = sequinSearchEnrichmentRelations.map(quoteStaticRelation).join(", ");

const pool = adminDatabase.$client;
const client = await pool.connect();
const migrationDatabase = drizzle({ client });

async function roleExists(role: string): Promise<boolean> {
	const result = await client.query<{ exists: boolean }>(
		"select exists(select 1 from pg_roles where rolname = $1) as exists",
		[role],
	);
	return result.rows[0]?.exists === true;
}

try {
	if (applicationRole !== adminRole) {
		const role = quoteRole(applicationRole);
		await migrationDatabase.transaction(async (transaction) => {
			await transaction.execute(sql.raw(`grant usage on schema public to ${role}`));
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
		});
	}

	if (await roleExists(replicationRole)) {
		const quotedReplicationRole = quoteRole(replicationRole);
		await migrationDatabase.transaction(async (transaction) => {
			await transaction.execute(
				sql.raw(`grant usage on schema public to ${quotedReplicationRole}`),
			);
			await transaction.execute(
				sql.raw(
					`grant select on table ${sequinReadableRelations} to ${quotedReplicationRole}`,
				),
			);
		});
	}
} finally {
	client.release();
	await pool.end();
}
