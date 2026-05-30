import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createToolConfig, type ToolEnv } from "../src/env";
import { renderCreateDatabaseSql } from "../src/env/repo-database-registry";

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
