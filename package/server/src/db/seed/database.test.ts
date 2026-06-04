import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, mock, test } from "bun:test";
import { RESET_DATABASE_TABLES, resetDatabase } from "./database";

const schemaDir = new URL("../schema", import.meta.url).pathname;

function schemaTableExports(): string[] {
  return [
    ...new Bun.Glob("*.ts").scanSync({
      cwd: schemaDir,
    }),
  ].flatMap((file) => {
    const source = readFileSync(join(schemaDir, file), "utf8");
    return Array.from(
      source.matchAll(/^export const (\w+) = pgTable\b/gm),
      (match) => match[1]!,
    );
  });
}

function createMockDb() {
  const tableNames = new Map(
    RESET_DATABASE_TABLES.map(([name, table]) => [table, name] as const),
  );
  const calls: string[] = [];
  return {
    db: {
      delete: mock(async (table: unknown) => {
        const name = tableNames.get(table as never);
        if (!name) throw new Error("resetDatabase deleted an unknown table");
        calls.push(name);
      }),
    },
    calls,
  };
}

describe("resetDatabase", () => {
  test("deletes every server Drizzle schema table", async () => {
    const { db, calls } = createMockDb();

    await resetDatabase(db as never);

    expect(new Set(calls)).toEqual(new Set(schemaTableExports()));
  });

  test("deletes FK dependents before their parents", async () => {
    const { db, calls } = createMockDb();

    await resetDatabase(db as never);

    const index = (table: string) => calls.indexOf(table);
    expect(index("ContentStructureAnchor")).toBeLessThan(
      index("ContentStructureNode"),
    );
    expect(index("ContentStructureNode")).toBeLessThan(
      index("ContentStructure"),
    );
    expect(index("CreditAttributionEvidence")).toBeLessThan(
      index("UnitExternalRef"),
    );
    expect(index("UnitExternalRef")).toBeLessThan(index("SourceSite"));
    expect(index("SourceSite")).toBeLessThan(index("Entity"));
    expect(index("CommentPromotion")).toBeLessThan(index("Comment"));
    expect(index("Comment")).toBeLessThan(index("Unit"));
    expect(index("Unit")).toBeLessThan(index("User"));
  });

  test("does not import Prisma runtime or generated clients", () => {
    const source = readFileSync(
      new URL("./database.ts", import.meta.url),
      "utf8",
    );

    expect(source).not.toContain("@prisma/");
    expect(source).not.toContain("/prisma/");
    expect(source).not.toContain("generated/client");
  });
});
