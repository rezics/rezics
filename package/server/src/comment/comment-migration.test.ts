import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("comment domain migration", () => {
  test("backfills legacy post replies into comments while preserving unit ids", () => {
    const migration = readFileSync(
      join(
        import.meta.dir,
        "../../prisma/migrations/20260601114500_backfill_post_replies_to_comments/migration.sql",
      ),
      "utf8",
    );

    expect(migration).toContain('INSERT INTO "Comment"');
    expect(migration).toContain('p."unitId"');
    expect(migration).toContain('p."rootPostUnitId"');
    expect(migration).toContain('p."parentPostUnitId" = p."rootPostUnitId"');
    expect(migration).toContain('subpath(p."path", 1)');
    expect(migration).toContain("SET \"type\" = 'COMMENT'");
    expect(migration).toContain('DELETE FROM "Post"');
  });
});
