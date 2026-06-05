import { PrismaPg } from "@prisma/adapter-pg";
import { SearchClient } from "@rezics/search/client";
import { setSearchDb, setSearchPrismaClient } from "@rezics/search/sync";
import { createServerDb } from "@rezics/server/db/factory";
import { PrismaClient } from "@rezics/server/prisma/generated/client";

export interface SearchRuntime {
  client: SearchClient;
  prisma: PrismaClient;
  disconnect(): Promise<void>;
}

export function createSearchRuntime(options: {
  serverDatabaseUrl: string;
  meiliHost: string;
  meiliMasterKey: string;
}): SearchRuntime {
  const adapter = new PrismaPg({
    connectionString: options.serverDatabaseUrl,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 2_000,
  });
  const prisma = new PrismaClient({ adapter });
  const serverDb = createServerDb(options.serverDatabaseUrl);
  setSearchDb(serverDb.db);
  setSearchPrismaClient(prisma);

  return {
    client: new SearchClient({
      host: options.meiliHost,
      apiKey: options.meiliMasterKey,
    }),
    prisma,
    disconnect: async () => {
      await Promise.all([
        prisma.$disconnect().catch(() => {}),
        serverDb.disconnect().catch(() => {}),
      ]);
    },
  };
}
