import { getEnv } from "../lib/env";
import { createAuthDbClient } from "../lib/db-factory";
import { createSeedSearchClient } from "../lib/search";

export async function runDbReset(): Promise<void> {
  const { resetDatabase } = await import("@rezics/server/db/seed/database");
  const { createServerDb } = await import("@rezics/server/db/factory");
  const { resetAuthDatabase } = await import("@rezics/auth/seed");
  const env = getEnv();
  const serverDb = createServerDb(env.SERVER_DATABASE_URL);
  const authDb = createAuthDbClient(env.AUTH_DATABASE_URL);

  try {
    console.log("[Reset] Full wipe mode");
    await resetDatabase(serverDb.db);
    await resetAuthDatabase(authDb.db);
  } finally {
    await Promise.all([
      serverDb.disconnect().catch(() => {}),
      authDb.disconnect().catch(() => {}),
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
