import { describe, expect, mock, test } from "bun:test";
import {
  ContentTranslation,
  Post,
  Realm,
  RealmMember,
  RealmTagApplication,
  RealmTagApplicationVote,
  RealmTagContext,
  TagVote,
  Unit,
  UnitRealm,
  UnitTag,
} from "../../schema";
import { seedRealmTaxonomy } from "./seed-realm-taxonomy";

function makeDb() {
  let nextId = 0;
  const calls = {
    inserts: [] as Array<{ table: unknown; value: any }>,
    conflicts: [] as Array<{ table: unknown; input: any; kind: string }>,
  };

  const createInsert = () =>
    mock((table: unknown) => ({
      values(value: any) {
        calls.inserts.push({ table, value });
        return {
          async returning() {
            return [{ id: `unit-${nextId++}` }];
          },
          async onConflictDoNothing(input?: any) {
            calls.conflicts.push({ table, input, kind: "nothing" });
          },
          async onConflictDoUpdate(input: any) {
            calls.conflicts.push({ table, input, kind: "update" });
          },
        };
      },
    }));

  const createSelectChain = () => ({
    innerJoin() {
      return createSelectChain();
    },
    where() {
      return {
        async limit(value: number) {
          expect(value).toBe(1);
          return [];
        },
      };
    },
  });

  const db: any = {
    select: mock(() => ({
      from() {
        return createSelectChain();
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

describe("seedRealmTaxonomy", () => {
  test("seeds shared tags, community realm, contexts, and tag applications through Drizzle", async () => {
    const db = makeDb();

    const result = await seedRealmTaxonomy(
      db as never,
      "root-user",
      "default-realm",
      { tag: "tag-scope", realm: "realm-scope" } as never,
    );

    expect(result.communityRealmId).toBeDefined();
    expect(result.sharedTagIds).toHaveLength(2);
    expect(db.calls.inserts).toContainEqual(
      expect.objectContaining({
        table: Unit,
        value: expect.objectContaining({
          type: "REALM",
          slug: "seed-scifi-readers",
          slugScope: "realm-scope",
        }),
      }),
    );
    expect(db.calls.inserts.some((call) => call.table === Realm)).toBe(true);
    expect(db.calls.inserts.some((call) => call.table === RealmMember)).toBe(
      true,
    );
    expect(db.calls.inserts.some((call) => call.table === Post)).toBe(true);
    expect(
      db.calls.inserts.some((call) => call.table === ContentTranslation),
    ).toBe(true);
    expect(
      db.calls.inserts.some((call) => call.table === RealmTagContext),
    ).toBe(true);
    expect(db.calls.inserts.some((call) => call.table === UnitRealm)).toBe(
      true,
    );
    expect(
      db.calls.inserts.some((call) => call.table === RealmTagApplication),
    ).toBe(true);
    expect(
      db.calls.inserts.some((call) => call.table === RealmTagApplicationVote),
    ).toBe(true);
    expect(db.calls.inserts.some((call) => call.table === TagVote)).toBe(true);
    expect(db.calls.inserts.some((call) => call.table === UnitTag)).toBe(true);
  });

  test("does not import Prisma runtime or generated clients", async () => {
    const source = await Bun.file(
      new URL("./seed-realm-taxonomy.ts", import.meta.url),
    ).text();

    expect(source).not.toContain("@prisma/");
    expect(source).not.toContain("/prisma/");
    expect(source).not.toContain("generated/client");
  });
});
