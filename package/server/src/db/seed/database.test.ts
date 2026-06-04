import { describe, expect, mock, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resetDatabase } from "./database";

function modelToDelegate(model: string): string {
  return `${model[0]!.toLowerCase()}${model.slice(1)}`;
}

function schemaDelegates(): string[] {
  const schema = readFileSync(
    new URL("../../../prisma/schema.prisma", import.meta.url),
    "utf8",
  );
  return Array.from(schema.matchAll(/^model\s+(\w+)\s+\{/gm), (match) =>
    modelToDelegate(match[1]!),
  );
}

function createMockPrisma(delegates: string[]) {
  const calls: string[] = [];
  const prisma = Object.fromEntries(
    delegates.map((delegate) => [
      delegate,
      {
        deleteMany: mock(async () => {
          calls.push(delegate);
          return { count: 0 };
        }),
      },
    ]),
  );
  return { prisma, calls };
}

describe("resetDatabase", () => {
  test("deletes every server schema delegate", async () => {
    const delegates = schemaDelegates();
    const { prisma, calls } = createMockPrisma(delegates);

    await resetDatabase(prisma as never);

    expect(new Set(calls)).toEqual(new Set(delegates));
  });

  test("deletes FK dependents before their parents", async () => {
    const delegates = schemaDelegates();
    const { prisma, calls } = createMockPrisma(delegates);

    await resetDatabase(prisma as never);

    const index = (delegate: string) => calls.indexOf(delegate);
    expect(index("contentStructureAnchor")).toBeLessThan(
      index("contentStructureNode"),
    );
    expect(index("contentStructureNode")).toBeLessThan(
      index("contentStructure"),
    );
    expect(index("creditAttributionEvidence")).toBeLessThan(
      index("unitExternalRef"),
    );
    expect(index("unitExternalRef")).toBeLessThan(index("sourceSite"));
    expect(index("sourceSite")).toBeLessThan(index("entity"));
    expect(index("commentPromotion")).toBeLessThan(index("comment"));
    expect(index("comment")).toBeLessThan(index("unit"));
    expect(index("unit")).toBeLessThan(index("user"));
  });
});
