import { SearchClient } from "@rezics/search/client";
import { setSearchDb } from "@rezics/search/sync";
import { createServerDb } from "@rezics/server/db/factory";

export interface SearchRuntime {
  client: SearchClient;
  disconnect(): Promise<void>;
}

export function createSearchRuntime(options: {
  serverDatabaseUrl: string;
  meiliHost: string;
  meiliMasterKey: string;
}): SearchRuntime {
  const serverDb = createServerDb(options.serverDatabaseUrl);
  setSearchDb(serverDb.db);

  return {
    client: new SearchClient({
      host: options.meiliHost,
      apiKey: options.meiliMasterKey,
    }),
    disconnect: async () => {
      await serverDb.disconnect().catch(() => {});
    },
  };
}
