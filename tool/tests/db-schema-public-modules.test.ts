import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = join(import.meta.dir, "../..");

const schemaModules = [
  {
    packageName: "server",
    importPath: "../../packages/server/src/db/schema/index.ts",
    sourcePath: "packages/server/src/db/schema/index.ts",
    rowSourcePath: "packages/server/src/db/schema/index.ts",
    tableExport: "Unit",
    rowAlias: "UnitRow",
    newRowAlias: "NewUnitRow",
    schemaType: "ServerSchema",
    relationsType: "ServerRelations",
  },
  {
    packageName: "auth",
    importPath: "../../packages/auth/src/db/schema/index.ts",
    sourcePath: "packages/auth/src/db/schema/index.ts",
    rowSourcePath: "packages/auth/src/db/schema/auth.ts",
    tableExport: "users",
    rowAlias: "UserRow",
    newRowAlias: "NewUserRow",
    schemaType: "AuthSchema",
    relationsType: "AuthRelations",
  },
  {
    packageName: "notify",
    importPath: "../../packages/notify/src/db/schema/index.ts",
    sourcePath: "packages/notify/src/db/schema/index.ts",
    rowSourcePath: "packages/notify/src/db/schema/notifications.ts",
    tableExport: "notifications",
    rowAlias: "NotificationRow",
    newRowAlias: "NewNotificationRow",
    schemaType: "NotifySchema",
    relationsType: "NotifyRelations",
  },
  {
    packageName: "reaction",
    importPath: "../../packages/reaction/src/db/schema/index.ts",
    sourcePath: "packages/reaction/src/db/schema/index.ts",
    rowSourcePath: "packages/reaction/src/db/schema/reactions.ts",
    tableExport: "reactions",
    rowAlias: "ReactionRow",
    newRowAlias: "NewReactionRow",
    schemaType: "ReactionSchema",
    relationsType: "ReactionRelations",
  },
  {
    packageName: "history",
    importPath: "../../packages/history/src/db/schema/index.ts",
    sourcePath: "packages/history/src/db/schema/index.ts",
    rowSourcePath: "packages/history/src/db/schema/history.ts",
    tableExport: "unitRevisions",
    rowAlias: "UnitRevisionRow",
    newRowAlias: "NewUnitRevisionRow",
    schemaType: "HistorySchema",
    relationsType: "HistoryRelations",
  },
  {
    packageName: "ranking",
    importPath: "../../packages/ranking/src/db/schema/index.ts",
    sourcePath: "packages/ranking/src/db/schema/index.ts",
    rowSourcePath: "packages/ranking/src/db/schema/ranking.ts",
    tableExport: "unitRankProjections",
    rowAlias: "UnitRankProjectionRow",
    newRowAlias: "NewUnitRankProjectionRow",
    schemaType: "RankingSchema",
    relationsType: "RankingRelations",
  },
] as const;

describe("database schema public modules", () => {
  for (const schemaModule of schemaModules) {
    test(`${schemaModule.packageName} exports stable schema surface`, async () => {
      const mod = await import(schemaModule.importPath);
      const source = readFileSync(
        join(repoRoot, schemaModule.sourcePath),
        "utf8",
      );
      const rowSource = readFileSync(
        join(repoRoot, schemaModule.rowSourcePath),
        "utf8",
      );

      expect(mod.schema).toBeDefined();
      expect(mod.schema[schemaModule.tableExport]).toBeDefined();
      expect(mod.relations).toBeDefined();
      expect(source).toContain(`type ${schemaModule.schemaType}`);
      expect(source).toContain(`type ${schemaModule.relationsType}`);
      expect(rowSource).toContain(schemaModule.rowAlias);
      expect(rowSource).toContain(schemaModule.newRowAlias);
    });
  }

  test("schema owner package manifests expose db and schema subpaths", () => {
    for (const schemaModule of schemaModules) {
      const manifest = JSON.parse(
        readFileSync(
          join(repoRoot, `packages/${schemaModule.packageName}/package.json`),
          "utf8",
        ),
      ) as {
        exports?: Record<string, unknown>;
      };

      expect(Object.hasOwn(manifest.exports ?? {}, "./db")).toBe(true);
      expect(Object.hasOwn(manifest.exports ?? {}, "./db/schema")).toBe(true);
    }
  });

  test("server exposes relations as a stable public db subpath", async () => {
    const manifest = JSON.parse(
      readFileSync(join(repoRoot, "packages/server/package.json"), "utf8"),
    ) as {
      exports?: Record<string, unknown>;
    };
    const dbIndexSource = readFileSync(
      join(repoRoot, "packages/server/src/db/index.ts"),
      "utf8",
    );
    const publicRelations = await import(
      "../../packages/server/src/db/relations/index.ts"
    );

    expect(Object.hasOwn(manifest.exports ?? {}, "./db/relations")).toBe(true);
    expect(dbIndexSource).toContain('export * from "./relations";');
    expect(publicRelations.relations).toBeDefined();
  });

  test("small schema-owner runtime sources do not import Prisma", () => {
    for (const packageName of ["notify", "reaction", "history", "ranking"]) {
      const sourceFiles = [
        ...new Bun.Glob("src/**/*.ts").scanSync({
          cwd: join(repoRoot, "packages", packageName),
        }),
      ].filter((file) => !file.endsWith(".test.ts"));

      for (const file of sourceFiles) {
        const source = readFileSync(
          join(repoRoot, "packages", packageName, file),
          "utf8",
        );
        expect(source).not.toContain("@prisma/client");
        expect(source).not.toContain("/prisma/");
      }
    }
  });
});
