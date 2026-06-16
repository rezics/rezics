import { describe, expect, test } from "bun:test";
import { createSeedRuntime } from "./runtime";

function createUserSyncDb() {
  return {
    select: () => ({
      from: () => ({
        leftJoin: () => ({
          where: () => ({
            limit: async () => [
              {
                unitId: "user-1",
                email: "seed@example.com",
                name: "Seed User",
                avatar: null,
                summary: null,
                description: null,
                descriptionText: null,
                followersCount: 0,
                followingsCount: 0,
                joinDate: null,
                permission: "USER",
                slug: "seed-user",
              },
            ],
          }),
        }),
      }),
    }),
  };
}

function createQueuedSelectDb(rowSets: unknown[][]) {
  const queue = [...rowSets];
  const nextRows = () => queue.shift() ?? [];
  const chain = () => {
    const api = {
      from: () => api,
      leftJoin: () => api,
      where: () => api,
      orderBy: async () => nextRows(),
      limit: async () => nextRows(),
      // biome-ignore lint/suspicious/noThenProperty: this mock intentionally implements Drizzle's thenable query builder contract.
      then: (resolve: (value: unknown[]) => unknown) =>
        Promise.resolve(nextRows()).then(resolve),
    };
    return api;
  };
  return { select: () => chain() };
}

function createZoneSyncDb() {
  return createQueuedSelectDb([
    [
      {
        unitId: "zone-1",
        ownerRealmUnitId: "realm-1",
        startsAt: null,
        endsAt: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
        unitStatus: "PUBLISHED",
        unitVisibility: "PUBLIC",
        unitModerationStatus: "APPROVED",
        userId: null,
        slug: "zone-one",
        isLanguageNeutral: false,
      },
    ],
    [
      {
        unitId: "zone-1",
        language: "en",
        title: "Zone One",
        description: null,
      },
    ],
    [{ unitId: "zone-1", language: "en", isPrimary: true, position: "a0" }],
    [],
    [{ unitId: "realm-1", language: "en", title: "Realm One" }],
  ]);
}

describe("createSeedRuntime", () => {
  test("stores special targets separately from sync state", async () => {
    const runtime = createSeedRuntime({
      config: {
        meiliMode: "skip",
        manifestFormat: "human",
        scenarioNames: [],
      },
      authDb: { disconnect: async () => {} } as never,
    });

    await runtime.sync.entity("entity-1");
    runtime.addSpecialTarget({
      label: "Complex shelf",
      scenario: "complex-shelf",
      unitType: "SHELF",
      unitId: "shelf-1",
    });

    expect(runtime.state.syncSummary.total).toBe(0);
    expect(runtime.state.specialTargets).toEqual([
      {
        label: "Complex shelf",
        scenario: "complex-shelf",
        unitType: "SHELF",
        unitId: "shelf-1",
      },
    ]);
  });

  test("requires a search client when Meili sync is enabled", () => {
    expect(() =>
      createSeedRuntime({
        config: {
          meiliMode: "init-and-sync",
          manifestFormat: "human",
          scenarioNames: [],
        },
        authDb: { disconnect: async () => {} } as never,
      }),
    ).toThrow(/SearchClient/);
  });

  test("requires a Drizzle server db when active sync is enabled", () => {
    expect(() =>
      createSeedRuntime({
        config: {
          meiliMode: "init-and-sync",
          manifestFormat: "human",
          scenarioNames: [],
        },
        authDb: { disconnect: async () => {} } as never,
        searchClient: {} as never,
      }),
    ).toThrow(/Drizzle server db/);
  });

  test("runs targeted factory sync without job-runner env", async () => {
    const previousJobRunnerBaseUrl = Bun.env.JOB_RUNNER_BASE_URL;
    const previousJobDatabaseUrl = Bun.env.JOB_DATABASE_URL;
    const previousSequinWebhookSecret = Bun.env.SEQUIN_WEBHOOK_SECRET;
    delete Bun.env.JOB_RUNNER_BASE_URL;
    delete Bun.env.JOB_DATABASE_URL;
    delete Bun.env.SEQUIN_WEBHOOK_SECRET;

    try {
      const syncedUsers: unknown[] = [];
      const runtime = createSeedRuntime({
        config: {
          meiliMode: "init-and-sync",
          manifestFormat: "human",
          scenarioNames: [],
        },
        authDb: { disconnect: async () => {} } as never,
        serverDb: createUserSyncDb() as never,
        searchClient: {
          addOrUpdateUsers: async (documents: unknown[]) => {
            syncedUsers.push(...documents);
          },
        } as never,
      });

      await runtime.sync.user("user-1");

      expect(runtime.state.syncSummary).toMatchObject({
        targets: { user: 1 },
        total: 1,
      });
      expect(syncedUsers).toEqual([
        {
          id: "user-1",
          unitId: "user-1",
          email: "seed@example.com",
          name: "Seed User",
          avatar: null,
          summary: null,
          description: null,
          descriptionText: null,
          followersCount: 0,
          followingsCount: 0,
          joinDate: null,
          permission: "USER",
          slug: "seed-user",
        },
      ]);
    } finally {
      if (previousJobRunnerBaseUrl === undefined) {
        delete Bun.env.JOB_RUNNER_BASE_URL;
      } else {
        Bun.env.JOB_RUNNER_BASE_URL = previousJobRunnerBaseUrl;
      }
      if (previousJobDatabaseUrl === undefined) {
        delete Bun.env.JOB_DATABASE_URL;
      } else {
        Bun.env.JOB_DATABASE_URL = previousJobDatabaseUrl;
      }
      if (previousSequinWebhookSecret === undefined) {
        delete Bun.env.SEQUIN_WEBHOOK_SECRET;
      } else {
        Bun.env.SEQUIN_WEBHOOK_SECRET = previousSequinWebhookSecret;
      }
    }
  });

  test("runs targeted zone sync for factory-created zones", async () => {
    const syncedZones: unknown[] = [];
    const runtime = createSeedRuntime({
      config: {
        meiliMode: "init-and-sync",
        manifestFormat: "human",
        scenarioNames: [],
      },
      authDb: { disconnect: async () => {} } as never,
      serverDb: createZoneSyncDb() as never,
      searchClient: {
        addOrUpdateZones: async (documents: unknown[]) => {
          syncedZones.push(...documents);
        },
        deleteZones: async () => {},
      } as never,
    });

    await runtime.sync.zone("zone-1");

    expect(runtime.state.syncSummary).toMatchObject({
      targets: { zone: 1 },
      total: 1,
    });
    expect(syncedZones).toMatchObject([
      {
        id: "zone-1",
        slug: "zone-one",
        ownerRealmUnitId: "realm-1",
        visibility: "PUBLIC",
      },
    ]);
  });
});
