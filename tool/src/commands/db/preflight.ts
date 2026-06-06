import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parse as parseDotenv } from "dotenv";
import pg from "pg";
import { createToolConfig, type ToolConfig } from "../../env";
import type { DbSchemaPackage } from "./packages";
import { getPackageDir } from "./paths";

type DbPreflightPhase = "beforeMigration" | "afterMigration";
type DbEnv = Record<string, string | undefined>;

export interface DbPreflightClient {
  query(query: string): Promise<{ rows: Record<string, unknown>[] }>;
}

const PACKAGE_DATABASE_ENV = {
  auth: "DATABASE_URL",
  server: "DATABASE_URL",
  notify: "NOTIFY_DATABASE_URL",
  reaction: "REACTION_DATABASE_URL",
  history: "HISTORY_DATABASE_URL",
  ranking: "RANKING_DATABASE_URL",
} as const satisfies Record<DbSchemaPackage, string>;

const SERVER_LTREE_STATUS_SQL = `
SELECT
  EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'ltree') AS exists,
  has_database_privilege(current_user, current_database(), 'CREATE') AS can_create_extension
`;

function readPackageEnv(pkg: DbSchemaPackage): Record<string, string> {
  const envPath = path.join(getPackageDir(pkg), ".env");
  if (!existsSync(envPath)) return {};
  return parseDotenv(readFileSync(envPath, "utf8"));
}

function localConnectionUrl(
  pkg: DbSchemaPackage,
  config: ToolConfig = createToolConfig(),
): string {
  const databaseName = config.schemaDatabaseNames[pkg];
  const port = config.sourceVerifyEnv.SOURCE_DB_PORT;
  const user = encodeURIComponent(config.sourceVerifyEnv.SOURCE_DB_USER);
  const password = encodeURIComponent(
    config.sourceVerifyEnv.SOURCE_DB_PASSWORD,
  );
  return `postgresql://${user}:${password}@127.0.0.1:${port}/${databaseName}?schema=public`;
}

export function resolveDbConnectionUrl(
  pkg: DbSchemaPackage,
  inputEnv: DbEnv = process.env,
  packageEnv: Record<string, string> = readPackageEnv(pkg),
): string {
  const key = PACKAGE_DATABASE_ENV[pkg];
  const url = inputEnv[key] ?? packageEnv[key] ?? localConnectionUrl(pkg);
  assertSaneConnectionUrl(pkg, key, url);
  return url;
}

function preflightLabel(pkg: DbSchemaPackage): string {
  return `@rezics/${pkg} database preflight`;
}

function assertSaneConnectionUrl(
  pkg: DbSchemaPackage,
  key: string,
  url: string,
): void {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
      throw new Error("unsupported protocol");
    }
    if (!parsed.hostname || parsed.pathname === "/" || parsed.pathname === "") {
      throw new Error("missing host or database name");
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : "invalid URL";
    throw new Error(
      `${preflightLabel(pkg)} failed: ${key} must be a valid PostgreSQL connection URL (${reason}).`,
    );
  }
}

async function runScalar<T>(
  client: DbPreflightClient,
  query: string,
  column: string,
): Promise<T> {
  const result = await client.query(query);
  return result.rows[0]?.[column] as T;
}

async function assertPostgres18(
  client: DbPreflightClient,
  pkg: DbSchemaPackage,
) {
  const versionNum = Number(
    await runScalar<string>(
      client,
      "SHOW server_version_num",
      "server_version_num",
    ),
  );
  if (!Number.isFinite(versionNum) || versionNum < 180000) {
    throw new Error(
      `${preflightLabel(pkg)} failed: PostgreSQL 18+ is required; server_version_num=${versionNum || "unknown"}.`,
    );
  }
}

async function assertUuidv7(client: DbPreflightClient, pkg: DbSchemaPackage) {
  try {
    await client.query("SELECT uuidv7()");
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "42883") {
      throw new Error(
        `${preflightLabel(pkg)} failed: uuidv7() is unavailable. Use PostgreSQL 18+ with built-in UUIDv7 support.`,
      );
    }
    throw error;
  }
}

async function assertServerLtree(
  client: DbPreflightClient,
  phase: DbPreflightPhase,
  pkg: DbSchemaPackage,
) {
  if (pkg !== "server") return;

  const result = await client.query(SERVER_LTREE_STATUS_SQL);
  const row = result.rows[0] ?? {};
  const exists = row.exists === true;
  const canCreateExtension = row.can_create_extension === true;

  if (exists) return;

  if (phase === "beforeMigration" && !canCreateExtension) {
    throw new Error(
      `${preflightLabel(pkg)} failed: ltree extension is missing and the connected role cannot create extensions in this database. Ask a DBA/elevated role to run CREATE EXTENSION IF NOT EXISTS ltree; then rerun migrations.`,
    );
  }

  if (phase === "afterMigration") {
    const privilegeHint = canCreateExtension
      ? "Rerun the server custom migration before applying ltree columns and indexes."
      : "Ask a DBA/elevated role to run CREATE EXTENSION IF NOT EXISTS ltree; then rerun migrations.";
    throw new Error(
      `${preflightLabel(pkg)} failed: ltree extension is missing after migrations. ${privilegeHint}`,
    );
  }
}

export async function runDbPreflightChecks(
  client: DbPreflightClient,
  pkg: DbSchemaPackage,
  phase: DbPreflightPhase,
): Promise<void> {
  await assertPostgres18(client, pkg);
  await assertUuidv7(client, pkg);
  await assertServerLtree(client, phase, pkg);
}

export async function runDbPreflight(
  pkg: DbSchemaPackage,
  phase: DbPreflightPhase,
): Promise<void> {
  const url = resolveDbConnectionUrl(pkg);
  const client = new pg.Client({ connectionString: url });
  try {
    await client.connect();
    await runDbPreflightChecks(client, pkg, phase);
  } finally {
    await client.end().catch(() => {});
  }
}
