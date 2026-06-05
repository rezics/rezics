import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";

const calls = {
  resetDatabase: 0,
  resetAuthDatabase: 0,
};

const seedUsers = [
  {
    email: "root@rezics.com",
    name: "Root User",
    slug: "root-user",
    permission: { role: ["ROOT"] },
  },
  {
    email: "admin@rezics.com",
    name: "Admin User",
    permission: { role: ["ADMIN"] },
  },
];

const infraUsers = [
  {
    slug: "rezics",
    name: "Rezics",
    bio: "Official platform account for Rezics-owned content.",
  },
  {
    slug: "rezics-wiki",
    name: "Rezics Wiki",
    bio: "Community catalog custodian account for wiki-owned content.",
  },
];

mock.module("@rezics/server/db/seed/database", () => ({
  resetDatabase: mock(async () => {
    calls.resetDatabase += 1;
  }),
}));

mock.module("@rezics/auth/seed", () => ({
  resetAuthDatabase: mock(async () => {
    calls.resetAuthDatabase += 1;
  }),
}));

mock.module("./infra", () => ({
  seedSlugScopes: mock(async () => ({ user: "scope-user" })),
  seedInfra: mock(async () => {}),
}));

mock.module("./users", () => ({
  INFRA_USERS: infraUsers,
  SEED_USERS: seedUsers,
  resetRootUser: mock(async () => ({
    result: {
      email: "root@example.test",
      name: "Root",
      password: "password",
      role: "ROOT",
      slug: "root",
      userId: "root-user",
    },
    serverRole: "ROOT",
  })),
  seedAllAuthUsers: mock(async () => []),
  seedAllMainUsers: mock(async (db: any, authResults: Map<string, any>) => {
    const { bootstrapSystemShelves, createDrizzleSystemShelfClient } =
      await import("@rezics/server/shelf/system-shelves");

    for (const result of authResults.values()) {
      await db.transaction(async (tx: any) => {
        await bootstrapSystemShelves(
          result.userId,
          result.slug,
          createDrizzleSystemShelfClient(tx),
        );
      });
    }

    return {
      rootUserId: "root-user",
      results: [],
    };
  }),
  seedInfraUsers: mock(async (db: any, slugScopes: { user: string }) => {
    const { Unit, User } = await import("@rezics/server/db/schema");
    const results: Record<string, string> = {};

    for (const input of infraUsers) {
      const [existing] = await db.select().from(Unit).where().limit(1);

      const unitId = existing?.id ?? `generated-${input.slug}`;
      results[input.slug] = unitId;

      if (!existing) {
        await db.insert(Unit).values({
          id: unitId,
          slug: input.slug,
          slugScope: slugScopes.user,
          type: "USER",
        });
      }

      await db.insert(User).values({
        unitId,
        authUserId: null,
        email: null,
        name: input.name,
      });
    }

    return results;
  }),
}));

afterAll(() => {
  mock.restore();
});

describe("seedBaseline", () => {
  beforeEach(() => {
    calls.resetDatabase = 0;
    calls.resetAuthDatabase = 0;
  });

  test("does not reset databases by default", async () => {
    const { seedBaseline } = await import("./index");

    await seedBaseline({} as never, { serverSeedDb: {} as never });

    expect(calls.resetDatabase).toBe(0);
    expect(calls.resetAuthDatabase).toBe(0);
  });

  test("can still reset databases when explicitly requested", async () => {
    const { seedBaseline } = await import("./index");

    await seedBaseline({} as never, {
      resetDatabases: true,
      serverSeedDb: {} as never,
      serverResetDb: {} as never,
    });

    expect(calls.resetDatabase).toBe(1);
    expect(calls.resetAuthDatabase).toBe(1);
  });

  test("requires a Drizzle server db for slug scopes", async () => {
    const { seedBaseline } = await import("./index");

    await expect(seedBaseline({} as never)).rejects.toThrow(
      /Drizzle server database client/,
    );
  });
});
