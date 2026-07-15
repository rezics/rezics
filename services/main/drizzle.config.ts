import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "drizzle-kit";
import { config as loadEnv } from "dotenv";

loadEnv({ path: resolve(fileURLToPath(new URL(".", import.meta.url)), "../.env"), quiet: true });

const databaseUrl = process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_ADMIN_URL or DATABASE_URL is required");

export default defineConfig({
	dialect: "postgresql",
	schema: "./src/services/database/schema/index.ts",
	out: "./src/services/database/migrations",
	dbCredentials: { url: databaseUrl },
});
