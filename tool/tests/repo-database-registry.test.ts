import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createToolConfig, type ToolEnv } from "../src/env";
import {
  renderCreateDatabaseSql,
  renderResetDatabaseSql,
} from "../src/env/repo-database-registry";

function toolEnv(values: Partial<ToolEnv>): ToolEnv {
  return values as ToolEnv;
}

describe("repo database SQL renderer", () => {
  test("renders SQL from caller-provided database names", () => {
    expect(renderCreateDatabaseSql(["alpha", "beta"])).toBe(
      [
        "SELECT 'CREATE DATABASE alpha'",
        "WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'alpha')\\gexec",
        "",
        "SELECT 'CREATE DATABASE beta'",
        "WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'beta')\\gexec",
        "",
      ].join("\n"),
    );
  });

  test("tool config owns the managed local database names", () => {
    const config = createToolConfig(toolEnv({}));

    expect(config.managedDatabaseNames).toContain("rezics_reaction");
    expect(config.managedDatabaseNames).not.toContain("reaction");
  });

  test("renders destructive reset SQL with quoted names", () => {
    expect(renderResetDatabaseSql(["alpha", 'quote"and\\apostrophe'])).toBe(
      [
        "SELECT pg_terminate_backend(pid)",
        "FROM pg_stat_activity",
        "WHERE datname = 'alpha' AND pid <> pg_backend_pid();",
        'DROP DATABASE IF EXISTS "alpha";',
        'CREATE DATABASE "alpha";',
        "",
        "SELECT pg_terminate_backend(pid)",
        "FROM pg_stat_activity",
        "WHERE datname = 'quote\"and\\apostrophe' AND pid <> pg_backend_pid();",
        'DROP DATABASE IF EXISTS "quote""and\\apostrophe";',
        'CREATE DATABASE "quote""and\\apostrophe";',
        "",
      ].join("\n"),
    );
  });

  test("keeps Docker bootstrap SQL derived from tool config", () => {
    const sqlPath = join(
      import.meta.dir,
      "../service/source-postgres/init/001-create-databases.sql",
    );
    const config = createToolConfig(toolEnv({}));

    expect(readFileSync(sqlPath, "utf8")).toBe(
      renderCreateDatabaseSql(config.managedDatabaseNames),
    );
  });
});
