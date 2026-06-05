import { describe, expect, mock, test } from "bun:test";
import { DEFAULT_REALM } from "@rezics/contract";
import {
  Realm,
  RealmMember,
  Unit,
  UnitSupportLanguage,
  UnitTranslation,
} from "../../schema";
import { seedDefaultRealm } from "./seed-default-realm";

function makeDb(selectRows: unknown[][] = []) {
  const calls = {
    inserts: [] as Array<{ table: unknown; value: any }>,
    updates: [] as Array<{ table: unknown; value: any }>,
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
    mock((table: unknown) => ({
      values(value: any) {
        calls.inserts.push({ table, value });
        return {
          async returning() {
            return [{ id: `realm-${nextUnitId++}` }];
          },
        };
      },
    }));

  const db: any = {
    select: createSelect(),
    update: mock((table: unknown) => ({
      set(value: any) {
        calls.updates.push({ table, value });
        return {
          async where() {},
        };
      },
    })),
    insert: createInsert(),
    transaction: mock(async (callback: (tx: unknown) => Promise<string>) =>
      callback({
        insert: createInsert(),
      }),
    ),
    calls,
  };

  return db;
}

describe("seedDefaultRealm", () => {
  test("reuses an existing realm by contract slug", async () => {
    const db = makeDb([[{ id: "realm-existing", type: "REALM" }]]);

    const result = await seedDefaultRealm(db as never, "root-user", {
      realm: "realm-scope",
    } as never);

    expect(result).toBe("realm-existing");
    expect(db.transaction).not.toHaveBeenCalled();
  });

  test("assigns the contract slug to an existing official realm", async () => {
    const db = makeDb([[], [{ unitId: "official-realm" }]]);

    const result = await seedDefaultRealm(db as never, "root-user", {
      realm: "realm-scope",
    } as never);

    expect(result).toBe("official-realm");
    expect(db.calls.updates).toEqual([
      {
        table: Unit,
        value: expect.objectContaining({
          slug: DEFAULT_REALM.slug,
          slugScope: "realm-scope",
        }),
      },
    ]);
  });

  test("creates the default realm graph through Drizzle", async () => {
    const db = makeDb([[], []]);

    const result = await seedDefaultRealm(db as never, "root-user", {
      realm: "realm-scope",
    } as never);

    expect(result).toBe("realm-0");
    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(db.calls.inserts.some((call) => call.table === Unit)).toBe(true);
    expect(db.calls.inserts.some((call) => call.table === Realm)).toBe(true);
    expect(db.calls.inserts.some((call) => call.table === RealmMember)).toBe(
      true,
    );
    expect(
      db.calls.inserts.filter((call) => call.table === UnitTranslation).length,
    ).toBe(Object.keys(DEFAULT_REALM.translations).length);
    expect(
      db.calls.inserts.filter((call) => call.table === UnitSupportLanguage)
        .length,
    ).toBe(Object.keys(DEFAULT_REALM.translations).length);
    expect(
      db.calls.inserts.find((call) => call.table === RealmMember)?.value,
    ).toMatchObject({
      realmUnitId: "realm-0",
      userId: "root-user",
      roleKey: "owner",
    });
  });

  test("does not import Prisma runtime or generated clients", async () => {
    const source = await Bun.file(
      new URL("./seed-default-realm.ts", import.meta.url),
    ).text();

    expect(source).not.toContain("@prisma/");
    expect(source).not.toContain("/prisma/");
    expect(source).not.toContain("generated/client");
  });
});
