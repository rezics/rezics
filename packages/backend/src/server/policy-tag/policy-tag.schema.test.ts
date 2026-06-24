import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

function policyTagMigrationSql() {
  const drizzleDir = join(import.meta.dir, "../../drizzle");
  for (const entry of readdirSync(drizzleDir)) {
    const migrationPath = join(drizzleDir, entry, "migration.sql");
    try {
      const sql = readFileSync(migrationPath, "utf8");
      if (sql.includes('CREATE TABLE "PolicyTagRule"')) {
        return sql;
      }
    } catch {}
  }
  throw new Error("PolicyTagRule migration not found");
}

describe("policy tag schema", () => {
  test("enforces sparse active-rule and application uniqueness in the migration", () => {
    const sql = policyTagMigrationSql();

    expect(sql).toContain(
      'CREATE UNIQUE INDEX "PolicyTagRule_global_active_tagUnitId_key"',
    );
    expect(sql).toContain(
      "WHERE (\"scopeKind\" = 'global' AND \"state\" = 'ACTIVE')",
    );
    expect(sql).toContain(
      'CREATE UNIQUE INDEX "PolicyTagRule_realm_active_realmUnitId_tagUnitId_key"',
    );
    expect(sql).toContain(
      "WHERE (\"scopeKind\" = 'realm' AND \"state\" = 'ACTIVE')",
    );
    expect(sql).toContain(
      'CREATE UNIQUE INDEX "PolicyTagApplication_ruleId_unitId_key"',
    );
  });
});
