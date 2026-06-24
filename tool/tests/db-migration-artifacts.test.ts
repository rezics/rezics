import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { DB_SCHEMA_PACKAGES } from "../src/commands/db/packages";

const repoRoot = new URL("../..", import.meta.url).pathname;
const serverDrizzleDir = new URL(
  "../../packages/server/drizzle",
  import.meta.url,
).pathname;

function readMigration(dirName: string): string {
  return readFileSync(join(serverDrizzleDir, dirName, "migration.sql"), "utf8");
}

describe("server Drizzle migration artifacts", () => {
  test("each schema owner has one generated baseline artifact", () => {
    for (const packageName of DB_SCHEMA_PACKAGES) {
      const drizzleDir = join(repoRoot, "packages", packageName, "drizzle");
      const migrationDirs = readdirSync(drizzleDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .filter(
          (name) => name.endsWith("_baseline") || packageName !== "server",
        )
        .sort();

      expect(migrationDirs).toHaveLength(1);

      const [baselineDir] = migrationDirs;
      if (!baselineDir) throw new Error(`Missing baseline for ${packageName}`);
      expect(
        readFileSync(join(drizzleDir, baselineDir, "migration.sql"), "utf8"),
      ).toContain("CREATE");
      expect(
        readFileSync(join(drizzleDir, baselineDir, "snapshot.json"), "utf8"),
      ).toContain('"tables"');
    }
  });

  test("custom SQL migrations run before the baseline", () => {
    const migrationDirs = readdirSync(serverDrizzleDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    expect(migrationDirs.slice(0, 3)).toEqual([
      "20260604061700_server_ltree_extension",
      "20260604061730_server_comment_path_helpers",
      "20260604061845_server_baseline",
    ]);
  });

  test("server custom SQL preserves extension helpers and drops stale comment path helpers", () => {
    const extensionSql = readMigration("20260604061700_server_ltree_extension");
    const helperSql = readMigration(
      "20260604061730_server_comment_path_helpers",
    );
    const cleanupSql = readMigration(
      "20260613213000_server_drop_comment_path_helpers",
    );

    expect(extensionSql).toContain("CREATE EXTENSION IF NOT EXISTS ltree");
    expect(helperSql).toContain(
      "CREATE OR REPLACE FUNCTION rezics_to_base36(n bigint)",
    );
    expect(helperSql).toContain("IMMUTABLE");
    expect(cleanupSql).toContain(
      "DROP FUNCTION IF EXISTS rezics_to_base36(bigint)",
    );
    expect(cleanupSql).toContain(
      'DROP SEQUENCE IF EXISTS "public"."post_path_label_seq"',
    );
  });

  test("server baseline keeps generated tables plus raw-owned SQL constructs", () => {
    const baselineSql = readMigration("20260604061845_server_baseline");

    expect(baselineSql).toContain(
      'CREATE SEQUENCE "public"."post_path_label_seq"',
    );
    expect(baselineSql).toContain('"path" ltree');
    expect(baselineSql).toContain(
      'CREATE INDEX "Comment_path_gist_idx" ON "Comment" USING gist ("path")',
    );
    expect(baselineSql).toContain(
      'CREATE UNIQUE INDEX "PollVote_single_choice_uniq" ON "PollVote" ("pollUnitId","userId") WHERE ("voteMode" = \'SINGLE\'::"PollVoteMode")',
    );
    expect(baselineSql).toContain(
      'CREATE INDEX "subscription_channels_gin" ON "Subscription" USING gin ("channels")',
    );
  });

  test("no empty generated migration directories remain", () => {
    const emptyMigrationDirs = readdirSync(serverDrizzleDir, {
      withFileTypes: true,
    })
      .filter((entry) => entry.isDirectory())
      .filter((entry) => {
        const files = readdirSync(join(serverDrizzleDir, entry.name));
        return !files.includes("migration.sql");
      })
      .map((entry) => basename(entry.name));

    expect(emptyMigrationDirs).toEqual([]);
  });
});
