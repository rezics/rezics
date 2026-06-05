import { describe, expect, mock, test } from "bun:test";
import { SLUG_SCOPES } from "@rezics/contract";
import type { SlugScopesMap } from "./seed-slug-scopes";
import { SlugScope, Unit } from "../../schema";
import { seedSlugScopes } from "./seed-slug-scopes";

function createSelectMock(existingIds: string[]) {
  let index = 0;
  return mock(() => ({
    from(table: unknown) {
      expect(table).toBe(SlugScope);
      return {
        where() {
          return {
            async limit(value: number) {
              expect(value).toBe(1);
              const unitId = existingIds[index++];
              return unitId ? [{ unitId }] : [];
            },
          };
        },
      };
    },
  }));
}

describe("seedSlugScopes", () => {
  test("reuses existing slug scope rows", async () => {
    const existingIds = SLUG_SCOPES.map((name) => `${name}-scope`);
    const db = {
      select: createSelectMock(existingIds),
      transaction: mock(async () => {
        throw new Error("transaction should not run for existing scopes");
      }),
    };

    const result = await seedSlugScopes(db as never);

    expect(result).toEqual(
      Object.fromEntries(
        SLUG_SCOPES.map((name) => [name, `${name}-scope`]),
      ) as SlugScopesMap,
    );
    expect(db.transaction).not.toHaveBeenCalled();
  });

  test("creates missing self-referencing SCOPE units in transactions", async () => {
    const insertedUnits: unknown[] = [];
    const insertedSlugScopes: unknown[] = [];
    const db = {
      select: createSelectMock([]),
      transaction: mock(async (callback: (tx: unknown) => Promise<string>) => {
        const id = `generated-${insertedUnits.length}`;
        const tx = {
          execute: mock(async () => ({ rows: [{ id }] })),
          insert: mock((table: unknown) => ({
            values(value: unknown) {
              if (table === Unit) insertedUnits.push(value);
              if (table === SlugScope) insertedSlugScopes.push(value);
              return Promise.resolve();
            },
          })),
        };
        return callback(tx);
      }),
    };

    const result = await seedSlugScopes(db as never);

    expect(db.transaction).toHaveBeenCalledTimes(SLUG_SCOPES.length);
    expect(insertedUnits).toHaveLength(SLUG_SCOPES.length);
    expect(insertedSlugScopes).toEqual(
      SLUG_SCOPES.map((slug, index) => ({
        slug,
        unitId: `generated-${index}`,
      })),
    );
    expect(result).toEqual(
      Object.fromEntries(
        SLUG_SCOPES.map((name, index) => [name, `generated-${index}`]),
      ) as SlugScopesMap,
    );
    for (const [index, unit] of insertedUnits.entries()) {
      expect(unit).toMatchObject({
        id: `generated-${index}`,
        type: "SCOPE",
        slug: null,
        slugScope: `generated-${index}`,
        status: "PUBLISHED",
        visibility: "PUBLIC",
        isLanguageNeutral: true,
      });
      expect((unit as { updatedAt?: unknown }).updatedAt).toBeInstanceOf(Date);
    }
  });

  test("does not import Prisma runtime or generated clients", async () => {
    const source = await Bun.file(
      new URL("./seed-slug-scopes.ts", import.meta.url),
    ).text();

    expect(source).not.toContain("@prisma/");
    expect(source).not.toContain("/prisma/");
    expect(source).not.toContain("generated/client");
  });
});
