import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { Client } from "pg";

const jobRunnerDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const backendPackageDir = path.resolve(jobRunnerDir, "../../..");
const repoRoot = path.resolve(backendPackageDir, "../..");

loadEnv({ path: path.join(jobRunnerDir, ".env"), quiet: true });
loadEnv({ path: path.join(backendPackageDir, ".env"), quiet: true });
loadEnv({ path: path.join(repoRoot, ".env"), quiet: true });

function argValue(name: string) {
  const prefix = `${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match?.slice(prefix.length);
}

function quoteIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function redactUrl(rawUrl: string) {
  const url = new URL(rawUrl);
  if (url.password) url.password = "*****";
  return url.toString();
}

function targetDatabaseName(rawUrl: string) {
  const url = new URL(rawUrl);
  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    throw new Error(
      `JOB_DATABASE_URL must use postgres/postgresql, got ${url.protocol}`,
    );
  }

  const database = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
  if (!database) {
    throw new Error("JOB_DATABASE_URL must include a database name");
  }

  return database;
}

function maintenanceUrl(rawUrl: string, database: string) {
  const url = new URL(rawUrl);
  url.pathname = `/${encodeURIComponent(database)}`;
  url.searchParams.delete("schema");
  return url.toString();
}

async function connectToMaintenanceDatabase(rawUrl: string, targetDb: string) {
  const candidates =
    targetDb === "postgres" ? ["template1"] : ["postgres", "template1"];
  let lastError: unknown;

  for (const candidate of candidates) {
    const connectionString = maintenanceUrl(rawUrl, candidate);
    const client = new Client({ connectionString });
    try {
      await client.connect();
      return { client, database: candidate };
    } catch (error) {
      await client.end().catch(() => undefined);
      lastError = error;
    }
  }

  throw lastError;
}

async function main() {
  const jobDatabaseUrl = argValue("--url") ?? process.env.JOB_DATABASE_URL;
  if (!jobDatabaseUrl) {
    throw new Error("Set JOB_DATABASE_URL or pass --url=postgresql://...");
  }

  const databaseName = targetDatabaseName(jobDatabaseUrl);
  const { client, database: maintenanceDb } =
    await connectToMaintenanceDatabase(jobDatabaseUrl, databaseName);

  try {
    const existing = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [databaseName],
    );

    if ((existing.rowCount ?? 0) > 0) {
      console.log(
        `[job-runner] database already exists: ${databaseName} via ${redactUrl(
          maintenanceUrl(jobDatabaseUrl, maintenanceDb),
        )}`,
      );
      return;
    }

    await client.query(`CREATE DATABASE ${quoteIdentifier(databaseName)}`);
    console.log(`[job-runner] created database: ${databaseName}`);
    console.log(
      "[job-runner] pg-boss schema and tables will be created on service start",
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
