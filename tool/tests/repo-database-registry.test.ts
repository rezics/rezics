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
  function resetSqlFor(databaseName: string) {
    const databaseLiteral = `'${databaseName.replaceAll("'", "''")}'`;
    const databaseIdentifier = `"${databaseName.replaceAll('"', '""')}"`;

    return [
      "SELECT pg_terminate_backend(pid)",
      "FROM pg_stat_activity",
      `WHERE datname = ${databaseLiteral} AND pid <> pg_backend_pid();`,
      "DO $$",
      "DECLARE",
      "  slot record;",
      "  remaining_attempts integer;",
      "BEGIN",
      "  FOR slot IN",
      "    SELECT slot_name, active_pid",
      "    FROM pg_replication_slots",
      `    WHERE database = ${databaseLiteral}`,
      "  LOOP",
      "    IF slot.active_pid IS NOT NULL THEN",
      "      PERFORM pg_terminate_backend(slot.active_pid);",
      "      remaining_attempts := 50;",
      "      WHILE EXISTS (",
      "        SELECT 1",
      "        FROM pg_replication_slots",
      "        WHERE slot_name = slot.slot_name AND active",
      "      ) AND remaining_attempts > 0 LOOP",
      "        PERFORM pg_sleep(0.1);",
      "        remaining_attempts := remaining_attempts - 1;",
      "      END LOOP;",
      "    END IF;",
      "",
      "    PERFORM pg_drop_replication_slot(slot.slot_name);",
      "  END LOOP;",
      "END $$;",
      `DROP DATABASE IF EXISTS ${databaseIdentifier};`,
      `CREATE DATABASE ${databaseIdentifier};`,
    ].join("\n");
  }

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
      `${[resetSqlFor("alpha"), resetSqlFor('quote"and\\apostrophe')].join(
        "\n\n",
      )}\n`,
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
