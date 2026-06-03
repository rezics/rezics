import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { seedGameMediaTaxonomy } from "./seed-game-media-taxonomy";

function makePrismaMock() {
  let nextId = 1;
  const createdUnits: unknown[] = [];

  return {
    prisma: {
      unit: {
        findUnique: async () => null,
        create: async ({ data }: { data: Record<string, unknown> }) => {
          const id = `unit-${nextId++}`;
          createdUnits.push({ id, data });
          return { id };
        },
      },
      unitTranslation: {
        upsert: async () => ({}),
      },
      unitSupportLanguage: {
        upsert: async () => ({}),
      },
    },
    createdUnits,
  };
}

describe("seedGameMediaTaxonomy", () => {
  test("seeds platform entities and rating tags", async () => {
    const mock = makePrismaMock();

    const result = await seedGameMediaTaxonomy(
      mock.prisma as never,
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

    expect(mock.createdUnits).toContainEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "ENTITY",
          slug: "windows",
          slugScope: "entity-scope",
          entity: {
            create: expect.objectContaining({
              kind: "game_platform",
              eligibleSubjectRoles: ["available_on"],
            }),
          },
        }),
      }),
    );
    expect(mock.createdUnits).toContainEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "TAG",
          slug: "esrb-teen",
          slugScope: "tag-scope",
        }),
      }),
    );
  });
});

describe("GameSystemRequirement migration", () => {
  test("creates source-aware platform/tier requirement storage", () => {
    const migration = readFileSync(
      new URL(
        "../../migrations/20260528110000_add_game_system_requirement/migration.sql",
        import.meta.url,
      ),
      "utf8",
    );

    expect(migration).toContain('CREATE TABLE "GameSystemRequirement"');
    expect(migration).toContain('"gameUnitId" UUID NOT NULL');
    expect(migration).toContain('"platformEntityId" UUID');
    expect(migration).toContain('"sourceRefId" UUID');
    expect(migration).toContain('"hardware" JSONB NOT NULL');
    expect(migration).toContain(
      'CREATE INDEX "GameSystemRequirement_gameUnitId_idx"',
    );
    expect(migration).toContain(
      'CREATE INDEX "GameSystemRequirement_platformEntityId_idx"',
    );
    expect(migration).toContain(
      'CREATE INDEX "GameSystemRequirement_tier_idx"',
    );
    expect(migration).toContain(
      'CREATE INDEX "GameSystemRequirement_sourceRefId_idx"',
    );
  });
});
