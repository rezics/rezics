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
                bio: null,
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
          bio: null,
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
});
