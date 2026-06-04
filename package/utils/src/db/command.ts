import { getEnv } from "../lib/env";
import { createAuthPrisma, createServerPrisma } from "../lib/prisma-factory";
import { createSeedSearchClient } from "../lib/search";

export async function runDbReset(): Promise<void> {
  const { resetDatabase } = await import("@rezics/server/db/seed/database");
  const { resetAuthDatabase } = await import("@rezics/auth/seed");
  const env = getEnv();
  const serverPrisma = createServerPrisma(env.SERVER_DATABASE_URL);
  const authPrisma = createAuthPrisma(env.AUTH_DATABASE_URL);

  try {
    console.log("[Reset] Full wipe mode");
    await resetDatabase(serverPrisma);
    await resetAuthDatabase(authPrisma.db);
  } finally {
    await Promise.all([
      serverPrisma.$disconnect().catch(() => {}),
      authPrisma.disconnect().catch(() => {}),
    ]);
  }
}

export async function runInitMeili(): Promise<void> {
  const { initMeiliSearch } = await import(
    "@rezics/server/db/seed/init-meili-search"
  );
  const env = getEnv();
  const searchClient = createSeedSearchClient({
    host: env.MEILI_HOST,
    apiKey: env.MEILI_MASTER_KEY,
  });
  await initMeiliSearch(searchClient);
}
