import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DOCKER_COMPOSE_COMMAND } from "../dev-external-services/compose-runtime";
import { createToolConfig } from "../env";
import { renderCreateDatabaseSql } from "../repo-database-registry";

const TOOL_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const SERVICE_DIR = path.join(TOOL_DIR, "dev-external-services");

export function ensureLocalDatabases() {
  const config = createToolConfig();
  // Managed startup may create empty databases for convenience; Prisma migrations remain the schema authority.
  const sql = renderCreateDatabaseSql(config.managedDatabaseNames);
  const args = [
    ...DOCKER_COMPOSE_COMMAND,
    "-p",
    config.services.composeProjectName,
    "-f",
    "compose.yml",
    "exec",
    "-T",
    "source-postgres",
    "psql",
    "-v",
    "ON_ERROR_STOP=1",
    "-U",
    config.sourceVerifyEnv.SOURCE_DB_USER,
    "-d",
    "postgres",
  ];

  const [command, ...commandArgs] = args;
  if (!command) {
    throw new Error("Docker Compose command is empty.");
  }

  const result = spawnSync(command, commandArgs, {
    cwd: SERVICE_DIR,
    env: {
      ...process.env,
      ...config.composeEnv,
      PGPASSWORD: config.sourceVerifyEnv.SOURCE_DB_PASSWORD,
    },
    input: sql,
    stdio: ["pipe", "inherit", "inherit"],
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(
      `Command failed with exit code ${result.status ?? "unknown"}: ${args.join(" ")}`,
    );
  }
}

if (import.meta.main) {
  ensureLocalDatabases();
}
