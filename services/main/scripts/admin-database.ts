import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";

loadEnv({
	path: resolve(fileURLToPath(new URL(".", import.meta.url)), "../../.env"),
	quiet: true,
});

const databaseUrl = process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_ADMIN_URL or DATABASE_URL is required");

export const adminDatabaseUrl = databaseUrl;
export const applicationDatabaseUrl = process.env.DATABASE_URL ?? adminDatabaseUrl;

export const adminDatabase = drizzle(adminDatabaseUrl);
