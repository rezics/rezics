import * as p from "@clack/prompts";
import { resetAuthDatabase } from "@rezics/backend/auth/seed";
import type { SearchClient } from "@rezics/search/client";
import { resetDatabase } from "@rezics/server/db/seed/database";
import { ensureMeiliIndexes } from "@rezics/server/db/seed/init-meili-search";
import type { SeedSyncHooks } from "@rezics/server/db/seed-factory";
import { type AuthDbClient, createAuthDbClient } from "../lib/db-factory";
import { getEnv } from "../lib/env";
import { createSeedSearchClient } from "../lib/search";
import { type ServerSeedDb, seedInfra, seedSlugScopes } from "./infra";
import { createSeedRuntime } from "./runtime";
import {
  type CrossSeedUserResult,
  resetRootUser,
  seedAllAuthUsers,
  seedAllMainUsers,
} from "./users";

export interface RunSeedOptions {
  resetDatabases?: boolean;
  serverSeedDb?: ServerSeedDb;
  serverResetDb?: Parameters<typeof resetDatabase>[0];
  sync?: SeedSyncHooks;
}

export interface SeedCredential {
  result: CrossSeedUserResult;
  serverRole: string;
}

export interface SeedBaselineResult {
  credentials: SeedCredential[];
  slugScopes: Awaited<ReturnType<typeof seedSlugScopes>>;
}

export function printSeedCredentials(
  credentials: SeedCredential[],
  opts: { singular?: boolean } = {},
): void {
  for (const { result, serverRole } of credentials) {
    p.log.info(
      [
        `${result.name} <${result.email}>`,
        `  Role: ${result.role} (auth) / ${serverRole} (server)`,
        `  Slug: ${result.slug}`,
        `  ID:   ${result.userId}`,
        `  Pass: ${result.password}`,
      ].join("\n"),
    );
  }

  if (credentials.length > 0) {
    p.log.warn(
      opts.singular
        ? "Store this password securely."
        : "Store these passwords securely.",
    );
  }
}

export async function seedBaseline(
  authDb: AuthDbClient,
  opts: RunSeedOptions = {},
): Promise<SeedBaselineResult> {
  const resetDatabases = opts.resetDatabases ?? false;

  if (!opts.serverSeedDb) {
    throw new Error("Seed baseline requires a Drizzle server database client.");
  }

  if (resetDatabases) {
    if (!opts.serverResetDb) {
      throw new Error("Reset mode requires a Drizzle server database client.");
    }
    const s = p.spinner();
    s.start("Resetting auth and server databases...");
    await resetDatabase(opts.serverResetDb);
    await resetAuthDatabase(authDb.db);
    s.stop("Databases reset.");
  }

  const scopeSpinner = p.spinner();
  scopeSpinner.start("Seeding slug scopes...");
  const slugScopes = await seedSlugScopes(opts.serverSeedDb);
  scopeSpinner.stop("Slug scopes seeded.");

  const userSpinner = p.spinner();
  userSpinner.start("Seeding users...");

  const authResults = await seedAllAuthUsers(authDb);
  const { rootUserId, infraUserIds, results } = await seedAllMainUsers(
    opts.serverSeedDb,
    authResults,
    slugScopes,
  );
  if (opts.sync) {
    for (const credential of results) {
      await opts.sync.user(credential.result.userId);
    }
    for (const userId of Object.values(infraUserIds)) {
      await opts.sync.user(userId);
    }
  }

  userSpinner.stop("Users seeded.");

  const infraSpinner = p.spinner();
  infraSpinner.start("Seeding infrastructure...");
  await seedInfra(rootUserId, {
    db: opts.serverSeedDb,
    slugScopes,
    sync: opts.sync,
  });
  infraSpinner.stop("Infrastructure seeded.");

  return { credentials: results, slugScopes };
}

async function createActiveSeedRuntime(input: {
  authDb: AuthDbClient;
  serverDb: Pick<ServerSeedDb, "select">;
  searchClient?: SearchClient;
}) {
  const env = getEnv();
  const searchClient =
    input.searchClient ??
    createSeedSearchClient({
      host: env.MEILI_HOST,
      apiKey: env.MEILI_MASTER_KEY,
    });
  await ensureMeiliIndexes(searchClient);
  return createSeedRuntime({
    config: {
      meiliMode: "init-and-sync",
      manifestFormat: "human",
      scenarioNames: [],
    },
    authDb: input.authDb,
    serverDb: input.serverDb,
    searchClient,
  });
}

export async function runSeed(opts: RunSeedOptions = {}): Promise<void> {
  const env = getEnv();
  const { createServerDb } = await import("@rezics/server/db/factory");
  const authDb: AuthDbClient = createAuthDbClient(env.AUTH_DATABASE_URL);
  const serverDb = createServerDb(env.SERVER_DATABASE_URL);
  let runtime: Awaited<ReturnType<typeof createActiveSeedRuntime>> | undefined;

  try {
    runtime = await createActiveSeedRuntime({
      authDb,
      serverDb: serverDb.db,
    });
    const { credentials } = await seedBaseline(authDb, {
      ...opts,
      serverSeedDb: serverDb.db,
      ...(opts.resetDatabases ? { serverResetDb: serverDb.db } : {}),
      sync: runtime.sync,
    });
    p.log.info(
      `Targeted Meili sync complete: ${runtime.state.syncSummary.total} operation(s).`,
    );
    printSeedCredentials(credentials);
  } finally {
    await Promise.all([
      runtime?.dispose() ?? authDb.disconnect().catch(() => {}),
      serverDb.disconnect().catch(() => {}),
    ]);
  }
}

export async function runResetRoot(): Promise<void> {
  const env = getEnv();
  const { createServerDb } = await import("@rezics/server/db/factory");
  const authDb: AuthDbClient = createAuthDbClient(env.AUTH_DATABASE_URL);
  const serverDb = createServerDb(env.SERVER_DATABASE_URL);
  let runtime: Awaited<ReturnType<typeof createActiveSeedRuntime>> | undefined;

  try {
    runtime = await createActiveSeedRuntime({
      authDb,
      serverDb: serverDb.db,
    });
    const s = p.spinner();
    s.start("Seeding slug scopes...");
    const slugScopes = await seedSlugScopes(serverDb.db);
    s.stop("Slug scopes ready.");

    const rootSpinner = p.spinner();
    rootSpinner.start("Resetting root user...");
    const { result, serverRole } = await resetRootUser(
      authDb,
      serverDb.db,
      slugScopes,
    );
    await runtime.sync.user(result.userId);
    await seedInfra(result.userId, {
      db: serverDb.db,
      slugScopes,
      sync: runtime.sync,
    });
    rootSpinner.stop("Root user reset.");
    p.log.info(
      `Targeted Meili sync complete: ${runtime.state.syncSummary.total} operation(s).`,
    );

    printSeedCredentials([{ result, serverRole }], { singular: true });
  } finally {
    await Promise.all([
      runtime?.dispose() ?? authDb.disconnect().catch(() => {}),
      serverDb.disconnect().catch(() => {}),
    ]);
  }
}
