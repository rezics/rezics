import * as p from "@clack/prompts";
import { resetAuthDatabase } from "@rezics/auth/seed";
import { resetDatabase } from "@rezics/server/db/seed/database";
import { type AuthDbClient, createAuthDbClient } from "../lib/db-factory";
import { getEnv } from "../lib/env";
import { type ServerSeedDb, seedInfra, seedSlugScopes } from "./infra";
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
  const { rootUserId, results } = await seedAllMainUsers(
    opts.serverSeedDb,
    authResults,
    slugScopes,
  );

  userSpinner.stop("Users seeded.");

  const infraSpinner = p.spinner();
  infraSpinner.start("Seeding infrastructure...");
  await seedInfra(rootUserId, {
    db: opts.serverSeedDb,
    slugScopes,
  });
  infraSpinner.stop("Infrastructure seeded.");

  return { credentials: results, slugScopes };
}

export async function runSeed(opts: RunSeedOptions = {}): Promise<void> {
  const env = getEnv();
  const { createServerDb } = await import("@rezics/server/db/factory");
  const authDb: AuthDbClient = createAuthDbClient(env.AUTH_DATABASE_URL);
  const serverDb = createServerDb(env.SERVER_DATABASE_URL);

  try {
    const { credentials } = await seedBaseline(authDb, {
      ...opts,
      serverSeedDb: serverDb.db,
      ...(opts.resetDatabases ? { serverResetDb: serverDb.db } : {}),
    });
    printSeedCredentials(credentials);
  } finally {
    await Promise.all([
      authDb.disconnect().catch(() => {}),
      serverDb.disconnect().catch(() => {}),
    ]);
  }
}

export async function runResetRoot(): Promise<void> {
  const env = getEnv();
  const { createServerDb } = await import("@rezics/server/db/factory");
  const authDb: AuthDbClient = createAuthDbClient(env.AUTH_DATABASE_URL);
  const serverDb = createServerDb(env.SERVER_DATABASE_URL);

  try {
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
    rootSpinner.stop("Root user reset.");

    printSeedCredentials([{ result, serverRole }], { singular: true });
  } finally {
    await Promise.all([
      authDb.disconnect().catch(() => {}),
      serverDb.disconnect().catch(() => {}),
    ]);
  }
}
