import type { SearchClient } from "@rezics/search/client";
import {
  patchContentContainedUnitIds,
  setSearchDb,
  setSearchPrismaClient,
  syncSingleContent,
  syncSingleEntity,
  syncSinglePost,
  syncSingleRealm,
  syncSingleUser,
} from "@rezics/search/sync";
import type { ServerDb } from "@rezics/server/db";
import type {
  FactoryScenarioName,
  SeedSyncHooks,
  SeedSyncSummary,
  SeedSyncTarget,
  SpecialSeedTarget,
} from "@rezics/server/db/seed-factory";
import type {
  AuthPrismaClient,
  ServerPrismaClient,
} from "../lib/prisma-factory";

export type MeiliMode = "init-and-sync" | "skip";
export type ManifestFormat = "human" | "json" | "both" | "none";

export interface SeedRunConfig {
  meiliMode: MeiliMode;
  manifestFormat: ManifestFormat;
  scenarioNames: FactoryScenarioName[];
}

export interface SeedRunState {
  specialTargets: SpecialSeedTarget[];
  syncSummary: SeedSyncSummary;
}

export interface SeedRuntime {
  config: SeedRunConfig;
  state: SeedRunState;
  clients: {
    authPrisma: AuthPrismaClient;
    serverPrisma: ServerPrismaClient;
    searchClient?: SearchClient;
  };
  sync: SeedSyncHooks;
  addSpecialTarget(target: SpecialSeedTarget): void;
  dispose(): Promise<void>;
}

export function createEmptySyncSummary(): SeedSyncSummary {
  return {
    targets: {
      content: 0,
      post: 0,
      realm: 0,
      user: 0,
      entity: 0,
      "content-contained-units": 0,
    },
    total: 0,
  };
}

function recordSync(summary: SeedSyncSummary, target: SeedSyncTarget): void {
  summary.targets[target]++;
  summary.total++;
}

function createNoopSyncHooks(): SeedSyncHooks {
  const noop = async () => {};
  return {
    content: noop,
    post: noop,
    realm: noop,
    user: noop,
    entity: noop,
    contentContainedUnits: noop,
  };
}

function createActiveSyncHooks(input: {
  prisma: ServerPrismaClient;
  db: Pick<ServerDb, "select">;
  searchClient: SearchClient;
  summary: SeedSyncSummary;
}): SeedSyncHooks {
  const { prisma, searchClient, summary } = input;
  setSearchDb(input.db);
  setSearchPrismaClient(prisma);

  return {
    async content(unitId) {
      await syncSingleContent(searchClient, unitId);
      recordSync(summary, "content");
    },
    async post(unitId) {
      await syncSinglePost(searchClient, unitId);
      recordSync(summary, "post");
    },
    async realm(unitId) {
      await syncSingleRealm(searchClient, unitId);
      recordSync(summary, "realm");
    },
    async user(unitId) {
      await syncSingleUser(searchClient, unitId);
      recordSync(summary, "user");
    },
    async entity(unitId) {
      await syncSingleEntity(searchClient, unitId);
      recordSync(summary, "entity");
    },
    async contentContainedUnits(unitId) {
      await patchContentContainedUnitIds(searchClient, unitId);
      recordSync(summary, "content-contained-units");
    },
  };
}

export function createSeedRuntime(input: {
  config: SeedRunConfig;
  authPrisma: AuthPrismaClient;
  serverPrisma: ServerPrismaClient;
  serverDb?: Pick<ServerDb, "select">;
  searchClient?: SearchClient;
}): SeedRuntime {
  if (input.config.meiliMode === "init-and-sync" && !input.searchClient) {
    throw new Error("Seed runtime requires a SearchClient for init-and-sync.");
  }

  const state: SeedRunState = {
    specialTargets: [],
    syncSummary: createEmptySyncSummary(),
  };
  const sync =
    input.config.meiliMode === "init-and-sync" && input.searchClient
      ? createActiveSyncHooks({
          prisma: input.serverPrisma,
          db: input.serverDb ?? missingServerDbForSearchSync(),
          searchClient: input.searchClient,
          summary: state.syncSummary,
        })
      : createNoopSyncHooks();

  return {
    config: input.config,
    state,
    clients: {
      authPrisma: input.authPrisma,
      serverPrisma: input.serverPrisma,
      ...(input.searchClient ? { searchClient: input.searchClient } : {}),
    },
    sync,
    addSpecialTarget(target) {
      const existing = state.specialTargets.find(
        (entry) =>
          entry.scenario === target.scenario && entry.unitId === target.unitId,
      );
      if (!existing) state.specialTargets.push(target);
    },
    async dispose() {
      await Promise.all([
        input.authPrisma.disconnect().catch(() => {}),
        input.serverPrisma.$disconnect().catch(() => {}),
      ]);
    },
  };
}

function missingServerDbForSearchSync(): never {
  throw new Error(
    "Seed runtime requires a Drizzle server db for init-and-sync.",
  );
}
