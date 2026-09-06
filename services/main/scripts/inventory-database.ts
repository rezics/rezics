import { Client } from "pg";
import { z } from "zod";
import { captureDatabaseInventory } from "./database-inventory";

const scope = z.enum(["local", "production"]).parse(process.argv[2]);
const connectionString = process.env.DATABASE_INVENTORY_URL;
if (!connectionString)
	throw new Error("DATABASE_INVENTORY_URL is required; use a read-only inventory credential");
const url = new URL(connectionString);
if (!["postgres:", "postgresql:"].includes(url.protocol))
	throw new Error("A PostgreSQL inventory URL is required");
const client = new Client({
	connectionString,
	connectionTimeoutMillis: 5_000,
	statement_timeout: 10_000,
	application_name: "rezics-operational-inventory",
});
await client.connect();
try {
	console.info(JSON.stringify(await captureDatabaseInventory(client, scope), null, 2));
} finally {
	await client.end();
}
