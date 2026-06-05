import { beforeEach, describe, expect, mock, test } from "bun:test";

const calls = {
  resetDatabase: 0,
  resetAuthDatabase: 0,
};

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
  seedAllMainUsers: mock(async () => ({
    rootUserId: "root-user",
    results: [],
  })),
}));

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
