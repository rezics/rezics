import { describe, expect, mock, test } from "bun:test";
import { Unit, UnitSupportLanguage, UnitTranslation, Zone } from "../../schema";
import {
  OFFICIAL_ZONE_DEFINITIONS,
  seedOfficialZones,
} from "./seed-official-zones";

type InsertCall = {
  table: unknown;
  value: any;
  conflict?: { target: unknown; set: Record<string, unknown> };
};

function makeDb(selectRows: unknown[][] = []) {
  const calls = {
    inserts: [] as InsertCall[],
    transactions: 0,
  };
  let nextUnitId = 0;

  const createSelect = () =>
    mock(() => ({
      from() {
        return {
          where() {
            return {
              async limit(value: number) {
                expect(value).toBe(1);
                return selectRows.shift() ?? [];
              },
            };
          },
        };
      },
    }));

  const createInsert = () =>
    mock((table: unknown) => {
      const call: InsertCall = { table, value: undefined };
      const builder = {
        values(value: any) {
          call.value = value;
          calls.inserts.push(call);
          return builder;
        },
        onConflictDoUpdate(input: {
          target: unknown;
          set: Record<string, unknown>;
        }) {
          call.conflict = input;
          return builder;
        },
        async returning() {
          return [{ id: `zone-${nextUnitId++}` }];
        },
        // biome-ignore lint/suspicious/noThenProperty: Drizzle insert doubles are awaitable.
        then(resolve: (value: unknown[]) => unknown) {
          return Promise.resolve([]).then(resolve);
        },
      };
      return builder;
    });

  const db: any = {
    select: createSelect(),
    insert: createInsert(),
    transaction: mock(async (callback: (tx: unknown) => Promise<string>) => {
      calls.transactions += 1;
      return callback({ insert: createInsert() });
    }),
    calls,
  };

  return db;
}

describe("seedOfficialZones", () => {
  test("creates Book, Realms, and Popular zones owned by the official realm", async () => {
    const db = makeDb([[], [], []]);

    const result = await seedOfficialZones(db as never, "realm-rezics", {
      zone: "zone-scope",
    } as never);

    expect(result).toEqual({
      book: "zone-0",
      realms: "zone-1",
      popular: "zone-2",
    });
    expect(db.calls.transactions).toBe(OFFICIAL_ZONE_DEFINITIONS.length);

    const unitInserts = db.calls.inserts.filter(
      (call: InsertCall) => call.table === Unit,
    );
    expect(unitInserts.map((call: InsertCall) => call.value.slug)).toEqual([
      "book",
      "realms",
      "popular",
    ]);
    expect(
      unitInserts.every(
        (call: InsertCall) =>
          call.value.type === "ZONE" && call.value.slugScope === "zone-scope",
      ),
    ).toBe(true);

    const zoneInserts = db.calls.inserts.filter(
      (call: InsertCall) => call.table === Zone,
    );
    expect(zoneInserts).toHaveLength(OFFICIAL_ZONE_DEFINITIONS.length);
    expect(
      zoneInserts.every(
        (call: InsertCall) =>
          call.value.ownerRealmUnitId === "realm-rezics" &&
          call.value.config?.schema === "rezics/zone-config" &&
          call.value.config?.version === 1 &&
          call.value.config?.pages?.home?.sections?.length > 0,
      ),
    ).toBe(true);
  });

  test("updates existing official zone rows idempotently", async () => {
    const db = makeDb([
      [{ id: "book-zone", type: "ZONE" }],
      [{ id: "realm-zone", type: "ZONE" }],
      [{ id: "popular-zone", type: "ZONE" }],
    ]);

    const result = await seedOfficialZones(db as never, "realm-rezics", {
      zone: "zone-scope",
    } as never);

    expect(result).toEqual({
      book: "book-zone",
      realms: "realm-zone",
      popular: "popular-zone",
    });
    expect(db.calls.transactions).toBe(0);

    const zoneInserts = db.calls.inserts.filter(
      (call: InsertCall) => call.table === Zone,
    );
    expect(zoneInserts).toHaveLength(OFFICIAL_ZONE_DEFINITIONS.length);
    expect(
      zoneInserts.every(
        (call: InsertCall) =>
          call.conflict &&
          call.conflict.set.ownerRealmUnitId === "realm-rezics" &&
          (call.conflict.set.config as { version?: number } | undefined)
            ?.version === 1,
      ),
    ).toBe(true);
  });

  test("rejects a deterministic official zone slug occupied by another unit type", async () => {
    const db = makeDb([[{ id: "book-id", type: "BOOK" }]]);

    await expect(
      seedOfficialZones(db as never, "realm-rezics", {
        zone: "zone-scope",
      } as never),
    ).rejects.toThrow(
      'Slug "book" under zone scope is already used by a non-ZONE unit',
    );
  });

  test("keeps localized titles and language rows idempotent", async () => {
    const db = makeDb([[], [], []]);

    await seedOfficialZones(db as never, "realm-rezics", {
      zone: "zone-scope",
    } as never);

    const translationInserts = db.calls.inserts.filter(
      (call: InsertCall) => call.table === UnitTranslation,
    );
    const supportLanguageInserts = db.calls.inserts.filter(
      (call: InsertCall) => call.table === UnitSupportLanguage,
    );
    const expectedLanguageRows = OFFICIAL_ZONE_DEFINITIONS.reduce(
      (sum, definition) => sum + Object.keys(definition.translations).length,
      0,
    );

    expect(translationInserts).toHaveLength(expectedLanguageRows);
    expect(supportLanguageInserts).toHaveLength(expectedLanguageRows);
    expect(
      translationInserts.every((call: InsertCall) => Boolean(call.conflict)),
    ).toBe(true);
    expect(
      supportLanguageInserts.every((call: InsertCall) =>
        Boolean(call.conflict),
      ),
    ).toBe(true);
  });

  test("does not import Prisma runtime or generated clients", async () => {
    const source = await Bun.file(
      new URL("./seed-official-zones.ts", import.meta.url),
    ).text();

    expect(source).not.toContain("@prisma/");
    expect(source).not.toContain("/prisma/");
    expect(source).not.toContain("generated/client");
  });
});
