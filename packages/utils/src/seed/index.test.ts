import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";

const calls = {
  resetDatabase: 0,
  resetAuthDatabase: 0,
  seedInfra: [] as Array<{ rootUserId: string; db: unknown; sync?: unknown }>,
  ensureMeiliIndexes: 0,
  runtimeDispose: 0,
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
    summary: "Official platform account for Rezics-owned content.",
  },
  {
    slug: "rezics-wiki",
    name: "Rezics Wiki",
    summary: "Community catalog custodian account for wiki-owned content.",
  },
];

mock.module("@rezics/server/db/seed/database", () => ({
  resetDatabase: mock(async () => {
    calls.resetDatabase += 1;
  }),
}));

mock.module("@rezics/server/db/seed/init-meili-search", () => ({
  ensureMeiliIndexes: mock(async () => {
    calls.ensureMeiliIndexes += 1;
  }),
}));

mock.module("@rezics/backend/auth/seed", () => ({
  resetAuthDatabase: mock(async () => {
    calls.resetAuthDatabase += 1;
  }),
}));

mock.module("./infra", () => ({
  seedSlugScopes: mock(async () => ({ user: "scope-user" })),
  seedInfra: mock(
    async (rootUserId: string, opts: { db: unknown; sync?: unknown }) => {
      calls.seedInfra.push({ rootUserId, db: opts.db, sync: opts.sync });
    },
  ),
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
      infraUserIds: {
        rezics: "generated-rezics",
        "rezics-wiki": "generated-rezics-wiki",
      },
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

mock.module("../lib/env", () => ({
  getEnv: () => ({
    AUTH_DATABASE_URL: "postgres://auth.test",
    SERVER_DATABASE_URL: "postgres://server.test",
  }),
}));

const serverDb = {
  db: { kind: "server-db" },
  disconnect: mock(async () => {}),
};
const authDb = {
  db: { kind: "auth-db" },
  disconnect: mock(async () => {}),
};

mock.module("../lib/db-factory", () => ({
  createAuthDbClient: mock(() => authDb),
}));

mock.module("../lib/search", () => ({
  createSeedSearchClient: mock(() => ({ kind: "search-client" })),
}));

const runtimeSync = {
  content: mock(async () => {}),
  post: mock(async () => {}),
  realm: mock(async () => {}),
  zone: mock(async () => {}),
  tag: mock(async () => {}),
  label: mock(async () => {}),
  user: mock(async () => {}),
  entity: mock(async () => {}),
  contentContainedUnits: mock(async () => {}),
};

mock.module("./runtime", () => ({
  createSeedRuntime: mock(() => ({
    sync: runtimeSync,
    state: { syncSummary: { total: 0, targets: {} } },
    dispose: mock(async () => {
      calls.runtimeDispose += 1;
    }),
  })),
}));

mock.module("@rezics/server/db/factory", () => ({
  createServerDb: mock(() => serverDb),
}));

afterAll(() => {
  mock.restore();
});

describe("seedBaseline", () => {
  beforeEach(() => {
    calls.resetDatabase = 0;
    calls.resetAuthDatabase = 0;
    calls.seedInfra = [];
    calls.ensureMeiliIndexes = 0;
    calls.runtimeDispose = 0;
    for (const fn of Object.values(runtimeSync)) {
      fn.mockClear();
    }
    serverDb.disconnect.mockClear();
    authDb.disconnect.mockClear();
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

  test("syncs seeded users and passes sync hooks to infra", async () => {
    const syncedUsers: string[] = [];
    const sync = {
      ...runtimeSync,
      user: mock(async (id: string) => {
        syncedUsers.push(id);
      }),
    };
    const serverSeedDb = {} as never;
    const { seedBaseline } = await import("./index");

    await seedBaseline({} as never, {
      serverSeedDb,
      sync,
    });

    expect(syncedUsers).toEqual(["generated-rezics", "generated-rezics-wiki"]);
    expect(calls.seedInfra).toEqual([
      {
        rootUserId: "root-user",
        db: serverSeedDb,
        sync,
      },
    ]);
  });

  test("reset-root reseeds infra so root default subscriptions are repaired", async () => {
    const { runResetRoot } = await import("./index");

    await runResetRoot();

    expect(calls.seedInfra).toEqual([
      {
        rootUserId: "root-user",
        db: serverDb.db,
        sync: runtimeSync,
      },
    ]);
    expect(calls.ensureMeiliIndexes).toBe(1);
    expect(runtimeSync.user).toHaveBeenCalledWith("root-user");
    expect(calls.runtimeDispose).toBe(1);
    expect(serverDb.disconnect).toHaveBeenCalledTimes(1);
    expect(authDb.disconnect).not.toHaveBeenCalled();
  });
});
