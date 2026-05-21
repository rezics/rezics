import { SearchClient } from "@rezics/search/client";
import {
  patchContentContainedUnitIds,
  setSearchPrismaClient,
  syncSingleContent,
  syncSingleEntity,
  syncSinglePost,
  syncSingleRealm,
} from "@rezics/search/sync";
import type { FactorySyncDependencies } from "@rezics/server/prisma/factory";
import type { ServerPrismaClient } from "./prisma-factory";

export function createSeedSearchClient(input: {
  host: string;
  apiKey: string;
}): SearchClient {
  return new SearchClient(input);
}

export function createFactorySyncDependencies(
  searchClient: SearchClient,
  prisma: ServerPrismaClient,
): FactorySyncDependencies {
  setSearchPrismaClient(prisma);
  return {
    searchClient,
    syncContent: syncSingleContent,
    syncPost: syncSinglePost,
    syncRealm: syncSingleRealm,
    syncEntity: syncSingleEntity,
    patchContentContainedUnitIds,
  };
}
