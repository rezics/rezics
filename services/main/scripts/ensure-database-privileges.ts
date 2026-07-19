import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";

import { adminDatabase, adminDatabaseUrl, applicationDatabaseUrl } from "./admin-database";

const adminRole = decodeURIComponent(new URL(adminDatabaseUrl).username);
const applicationRole = decodeURIComponent(new URL(applicationDatabaseUrl).username);
if (!adminRole || !applicationRole) throw new Error("Database URLs must include a username");

const pool = adminDatabase.$client;
const client = await pool.connect();
const migrationDatabase = drizzle({ client });

try {
	if (applicationRole !== adminRole) {
		const role = `"${applicationRole.replaceAll('"', '""')}"`;
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
} finally {
	client.release();
	await pool.end();
}
