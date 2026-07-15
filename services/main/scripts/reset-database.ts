import { Client } from "pg";

import { adminDatabaseUrl } from "./admin-database";

if (!process.argv.includes("--yes")) {
	throw new Error("Refusing to reset the database without --yes");
}

const url = new URL(adminDatabaseUrl);
if (!["127.0.0.1", "localhost", "::1"].includes(url.hostname)) {
	throw new Error(`Refusing to reset non-local database host: ${url.hostname}`);
}

const client = new Client({ connectionString: adminDatabaseUrl });
try {
	await client.connect();
	await client.query('drop schema if exists "public" cascade; create schema "public";');
} finally {
	await client.end();
}
