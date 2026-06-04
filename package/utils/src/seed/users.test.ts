import { afterEach, describe, expect, mock, test } from "bun:test";
import { Unit, User } from "@rezics/server/db/schema";

const bootstrapMock = mock(async () => {});
const createSystemShelfClientMock = mock((tx: unknown) => ({ tx }));
const seedAuthUserMock = mock(async () => ({
  userId: "auth-user",
  email: "auth@example.test",
  name: "Auth User",
  authUserId: "auth-user",
  slug: "auth-user",
  password: "password",
}));

mock.module("@rezics/auth/seed", () => ({
  seedAuthUser: seedAuthUserMock,
  slugify: (value: string) => value.toLowerCase().replace(/\s+/g, "-"),
}));

mock.module("@rezics/server/shelf/system-shelves", () => ({
  bootstrapSystemShelves: bootstrapMock,
  createDrizzleSystemShelfClient: createSystemShelfClientMock,
}));

afterEach(() => {
  bootstrapMock.mockClear();
  createSystemShelfClientMock.mockClear();
  seedAuthUserMock.mockClear();
});

function makeDrizzleStub(selectRows: unknown[][] = []) {
  const calls = {
    inserts: [] as Array<{ table: unknown; value: any }>,
    updates: [] as Array<{ table: unknown; value: any }>,
    conflicts: [] as Array<{ table: unknown; input: any }>,
  };
  let nextGeneratedId = 0;

  const createInsert = () =>
    mock((table: unknown) => ({
      values(value: any) {
        calls.inserts.push({ table, value });
        return {
          async onConflictDoUpdate(input: any) {
            calls.conflicts.push({ table, input });
          },
        };
      },
    }));

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

  const createUpdate = () =>
    mock((table: unknown) => ({
      set(value: any) {
        calls.updates.push({ table, value });
        return {
          async where() {},
        };
      },
    }));

  const db: any = {
    insert: createInsert(),
    select: createSelect(),
    update: createUpdate(),
    transaction: mock(async (callback: (tx: any) => Promise<unknown>) => {
      const tx = {
        insert: createInsert(),
        select: createSelect(),
        update: createUpdate(),
        execute: mock(async () => ({
          rows: [{ id: `generated-infra-user-${nextGeneratedId++}` }],
        })),
      };
      return callback(tx);
    }),
    calls,
  };

  return db;
}

describe("seedAllMainUsers", () => {
  test("calls bootstrapSystemShelves for every fixture user with its slug", async () => {
    const { SEED_USERS, seedAllMainUsers } = await import("./users");

    const authResults = new Map(
      SEED_USERS.map((input) => [
        input.email,
        {
          userId: `unit-${input.email}`,
          email: input.email,
          name: input.name,
          authUserId: `unit-${input.email}`,
          slug: input.slug ?? input.name.toLowerCase().replace(/\s+/g, "-"),
          password: "x",
        } as any,
      ]),
    );
    const db = makeDrizzleStub();

    await seedAllMainUsers(
      db as any,
      authResults as any,
      {
        user: "user-scope",
      } as any,
    );

    expect(bootstrapMock).toHaveBeenCalledTimes(SEED_USERS.length);
    const callArgs = bootstrapMock.mock.calls as any[];
    const seenUserIds = callArgs.map((args) => args[0]);
    for (const input of SEED_USERS) {
      expect(seenUserIds).toContain(`unit-${input.email}`);
    }
    for (const args of callArgs) {
      expect(typeof args[1]).toBe("string");
      expect(args[1].length).toBeGreaterThan(0);
      expect(args[2]).toEqual({ tx: expect.any(Object) });
    }
  });

  test("seeds infra users without auth identity bindings", async () => {
    const { INFRA_USERS, seedInfraUsers } = await import("./users");
    const db = makeDrizzleStub();

    await seedInfraUsers(db as any, { user: "user-scope" } as any);

    const userRows = db.calls.inserts
      .filter((call: any) => call.table === User)
      .map((call: any) => call.value);
    expect(userRows).toHaveLength(INFRA_USERS.length);
    for (const row of userRows) {
      expect(row.authUserId).toBeNull();
      expect(row.email).toBeNull();
    }
  });

  test("reuses existing infra user Units by slug", async () => {
    const { INFRA_USERS, seedInfraUsers } = await import("./users");
    const db = makeDrizzleStub(
      INFRA_USERS.map((input) => [
        { id: `existing-${input.slug}`, type: "USER" },
      ]),
    );

    const result = await seedInfraUsers(
      db as any,
      {
        user: "user-scope",
      } as any,
    );

    expect(db.transaction).not.toHaveBeenCalled();
    const createdUnits = db.calls.inserts.filter(
      (call: any) => call.table === Unit,
    );
    expect(createdUnits).toEqual([]);
    for (const input of INFRA_USERS) {
      expect(result[input.slug]).toBe(`existing-${input.slug}`);
    }
  });
});
