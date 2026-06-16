import { spawnSync } from "node:child_process";
import { createToolConfig } from "../../env";
import { renderCreateDatabaseSql } from "../../env/repo-database-registry";

export function ensureLocalDatabases() {
  const config = createToolConfig();
  // Nomad dev maps postgres to loopback; connect directly via psql.
  // Nomad 开发环境将 postgres 映射到 loopback；直接通过 psql 连接。
  const sql = renderCreateDatabaseSql(config.managedDatabaseNames);
  const { host, port, user, password } = config.postgres;

  const result = spawnSync(
    "psql",
    [
      "-v",
      "ON_ERROR_STOP=1",
      "-h",
      host,
      "-p",
      port,
      "-U",
      user,
      "-d",
      "postgres",
    ],
    {
      env: { ...process.env, PGPASSWORD: password },
      input: sql,
      stdio: ["pipe", "inherit", "inherit"],
    },
  );

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`psql failed with exit code ${result.status ?? "unknown"}`);
  }
}

if (import.meta.main) {
  ensureLocalDatabases();
}
