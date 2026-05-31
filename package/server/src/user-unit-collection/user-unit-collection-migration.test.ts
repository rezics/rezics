import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("user unit collection migration", () => {
  test("backfills shared collection metadata from shelf containment", () => {
    const migration = readFileSync(
      join(
        import.meta.dir,
        "../../prisma/migrations/20260601121000_backfill_user_unit_collection/migration.sql",
      ),
      "utf8",
    );

    expect(migration).toContain('INSERT INTO "UserUnitCollection"');
    expect(migration).toContain('FROM "ShelfUnit"');
    expect(migration).toContain('JOIN "Shelf"');
    expect(migration).toContain('JOIN "Unit" shelf_unit');
    expect(migration).toContain('ON CONFLICT ("userId", "unitId") DO NOTHING');
    expect(migration).toContain("no legacy per-shelf tag state");
  });
});
