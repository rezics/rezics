import { createAuthDbClient } from "../lib/db-factory";
import { getEnv } from "../lib/env";
import { createSeedSearchClient } from "../lib/search";

export async function runDbReset(): Promise<void> {
  const { resetDatabase } = await import("@rezics/server/db/seed/database");
  const { createServerDb } = await import("@rezics/server/db/factory");
  const { resetAuthDatabase } = await import("@rezics/auth/seed");
  const { resetMeiliIndexes } = await import(
    "@rezics/server/db/seed/init-meili-search"
  );
  const env = getEnv();
  const serverDb = createServerDb(env.SERVER_DATABASE_URL);
  const authDb = createAuthDbClient(env.AUTH_DATABASE_URL);
  const searchClient = createSeedSearchClient({
    host: env.MEILI_HOST,
    apiKey: env.MEILI_MASTER_KEY,
  });

  try {
    console.log("[Reset] Full wipe mode");
    await resetDatabase(serverDb.db);
    await resetAuthDatabase(authDb.db);
    await resetMeiliIndexes(searchClient);
  } finally {
    await Promise.all([
      serverDb.disconnect().catch(() => {}),
      authDb.disconnect().catch(() => {}),
    ]);
  }
}

export async function runInitMeili(): Promise<void> {
  const { ensureMeiliIndexes } = await import(
    "@rezics/server/db/seed/init-meili-search"
  );
  const env = getEnv();
  const searchClient = createSeedSearchClient({
    host: env.MEILI_HOST,
    apiKey: env.MEILI_MASTER_KEY,
  });
  await ensureMeiliIndexes(searchClient);
}

export async function runResetMeili(): Promise<void> {
  const { resetMeiliIndexes } = await import(
    "@rezics/server/db/seed/init-meili-search"
  );
  const env = getEnv();
  const searchClient = createSeedSearchClient({
    host: env.MEILI_HOST,
    apiKey: env.MEILI_MASTER_KEY,
  });
  await resetMeiliIndexes(searchClient);
}
