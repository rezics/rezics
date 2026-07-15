import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

import { adminDatabase, adminDatabaseUrl, applicationDatabaseUrl } from "./admin-database";

const adminRole = decodeURIComponent(new URL(adminDatabaseUrl).username);
const applicationRole = decodeURIComponent(new URL(applicationDatabaseUrl).username);
if (!adminRole || !applicationRole) throw new Error("Database URLs must include a username");

const pool = adminDatabase.$client;
const client = await pool.connect();
const migrationDatabase = drizzle({ client });
let locked = false;

try {
	await client.query("select pg_advisory_lock(hashtextextended($1, 0))", [
		"rezics-database-migrate",
	]);
	locked = true;
	await migrate(migrationDatabase, {
		migrationsFolder: resolve(
			fileURLToPath(new URL(".", import.meta.url)),
			"../src/services/database/migrations",
		),
		migrationsSchema: "public",
	});
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
				sql.raw(`revoke all privileges on table public.__drizzle_migrations from ${role}`),
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
	try {
		if (locked)
			await client.query("select pg_advisory_unlock(hashtextextended($1, 0))", [
				"rezics-database-migrate",
			]);
	} finally {
		client.release();
		await pool.end();
	}
}
