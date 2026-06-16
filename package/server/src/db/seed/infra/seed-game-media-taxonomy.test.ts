import { describe, expect, mock, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  Entity,
  Unit,
  UnitSupportLanguage,
  UnitTranslation,
} from "../../schema";
import { seedGameMediaTaxonomy } from "./seed-game-media-taxonomy";

function makeDb() {
  let nextId = 1;
  const calls = {
    inserts: [] as Array<{ table: unknown; value: any }>,
    conflicts: [] as Array<{ table: unknown; input: any }>,
  };

  const createInsert = () =>
    mock((table: unknown) => ({
      values(value: any) {
        calls.inserts.push({ table, value });
        return {
          async returning() {
            return [{ id: `unit-${nextId++}` }];
          },
          async onConflictDoUpdate(input: any) {
            calls.conflicts.push({ table, input });
          },
        };
      },
    }));

  const db: any = {
    select: mock(() => ({
      from() {
        return {
          where() {
            return {
              async limit(value: number) {
                expect(value).toBe(1);
                return [];
              },
            };
          },
        };
      },
    })),
    insert: createInsert(),
    update: mock(() => ({
      set() {
        return { async where() {} };
      },
    })),
    transaction: mock(async (callback: (tx: unknown) => Promise<string>) =>
      callback({
        insert: createInsert(),
      }),
    ),
    calls,
  };

  return db;
}

describe("seedGameMediaTaxonomy", () => {
  test("seeds platform entities and rating tags through Drizzle", async () => {
    const db = makeDb();

    const result = await seedGameMediaTaxonomy(
      db as never,
      {
        entity: "entity-scope",
        tag: "tag-scope",
      } as never,
    );

    expect(result.platformEntityIds.windows).toBeDefined();
    expect(result.platformEntityIds.ios).toBeDefined();
    expect(result.platformEntityIds.android).toBeDefined();
    expect(result.ratingTagIds["esrb-teen"]).toBeDefined();
    expect(result.ratingTagIds["esrb-mature"]).toBeDefined();

    expect(db.calls.inserts).toContainEqual(
      expect.objectContaining({
        table: Unit,
        value: expect.objectContaining({
          type: "ENTITY",
          slug: "windows",
          slugScope: "entity-scope",
        }),
      }),
    );
    expect(db.calls.inserts).toContainEqual(
      expect.objectContaining({
        table: Entity,
        value: expect.objectContaining({
          kind: "game_platform",
          eligibleSubjectRoles: ["available_on"],
        }),
      }),
    );
    expect(db.calls.inserts).toContainEqual(
      expect.objectContaining({
        table: Unit,
        value: expect.objectContaining({
          type: "TAG",
          slug: "esrb-teen",
          slugScope: "tag-scope",
        }),
      }),
    );
    expect(
      db.calls.inserts.some((call: any) => call.table === UnitTranslation),
    ).toBe(true);
    expect(
      db.calls.inserts.some((call: any) => call.table === UnitSupportLanguage),
    ).toBe(true);
  });

  test("does not import Prisma runtime or generated clients", async () => {
    const source = await Bun.file(
      new URL("./seed-game-media-taxonomy.ts", import.meta.url),
    ).text();

    expect(source).not.toContain("@prisma/");
    expect(source).not.toContain("/prisma/");
    expect(source).not.toContain("generated/client");
  });
});

describe("GameSystemRequirement migration", () => {
  test("renames requirement evidence links to UnitExternalLink", () => {
    const migration = readFileSync(
      new URL(
        "../../../../drizzle/20260612170022_lying_sentry/migration.sql",
        import.meta.url,
      ),
      "utf8",
    );

    expect(migration).toContain('CREATE TABLE "UnitExternalLink"');
    expect(migration).toContain('INSERT INTO "UnitExternalLink"');
    expect(migration).toContain(
      'ALTER TABLE "GameSystemRequirement" RENAME COLUMN "sourceRefId" TO "sourceExternalLinkId"',
    );
    expect(migration).toContain(
      'ALTER INDEX "GameSystemRequirement_sourceRefId_idx" RENAME TO "GameSystemRequirement_sourceExternalLinkId_idx"',
    );
    expect(migration).toContain('REFERENCES "UnitExternalLink"("id")');
  });
});
