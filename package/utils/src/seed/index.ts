import * as p from "@clack/prompts";
import { resetAuthDatabase } from "@rezics/auth/seed";
import { resetDatabase } from "@rezics/server/prisma/seed/database";
import { getEnv } from "../lib/env";
import {
  type AuthPrismaClient,
  createAuthPrisma,
  createServerPrisma,
  type ServerPrismaClient,
} from "../lib/prisma-factory";
import { seedInfra, seedSlugScopes } from "./infra";
import {
  type CrossSeedUserResult,
  resetRootUser,
  seedAllAuthUsers,
  seedAllMainUsers,
} from "./users";

export interface RunSeedOptions {
  resetDatabases?: boolean;
}

export interface SeedCredential {
  result: CrossSeedUserResult;
  serverRole: string;
}

export interface SeedBaselineResult {
  credentials: SeedCredential[];
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
  authPrisma: AuthPrismaClient,
  serverPrisma: ServerPrismaClient,
  opts: RunSeedOptions = {},
): Promise<SeedBaselineResult> {
  const resetDatabases = opts.resetDatabases ?? false;

  if (resetDatabases) {
    const s = p.spinner();
    s.start("Resetting auth and server databases...");
    await resetDatabase(serverPrisma);
    await resetAuthDatabase(authPrisma.db);
    s.stop("Databases reset.");
  }

  const scopeSpinner = p.spinner();
  scopeSpinner.start("Seeding slug scopes...");
  const slugScopes = await seedSlugScopes(serverPrisma);
  scopeSpinner.stop("Slug scopes seeded.");

  const userSpinner = p.spinner();
  userSpinner.start("Seeding users...");

  const authResults = await seedAllAuthUsers(authPrisma);
  const { rootUserId, results } = await seedAllMainUsers(
    serverPrisma,
    authResults,
    slugScopes,
  );

  userSpinner.stop("Users seeded.");

  const infraSpinner = p.spinner();
  infraSpinner.start("Seeding infrastructure...");
  await seedInfra(serverPrisma, rootUserId);
  infraSpinner.stop("Infrastructure seeded.");

  return { credentials: results };
}

export async function runSeed(opts: RunSeedOptions = {}): Promise<void> {
  const env = getEnv();
  const authPrisma: AuthPrismaClient = createAuthPrisma(env.AUTH_DATABASE_URL);
  const serverPrisma: ServerPrismaClient = createServerPrisma(
    env.SERVER_DATABASE_URL,
  );

  try {
    const { credentials } = await seedBaseline(authPrisma, serverPrisma, opts);
    printSeedCredentials(credentials);
  } finally {
    await Promise.all([
      authPrisma.disconnect().catch(() => {}),
      serverPrisma.$disconnect().catch(() => {}),
    ]);
  }
}

export async function runResetRoot(): Promise<void> {
  const env = getEnv();
  const authPrisma: AuthPrismaClient = createAuthPrisma(env.AUTH_DATABASE_URL);
  const serverPrisma: ServerPrismaClient = createServerPrisma(
    env.SERVER_DATABASE_URL,
  );

  try {
    const s = p.spinner();
    s.start("Seeding slug scopes...");
    const slugScopes = await seedSlugScopes(serverPrisma);
    s.stop("Slug scopes ready.");

    const rootSpinner = p.spinner();
    rootSpinner.start("Resetting root user...");
    const { result, serverRole } = await resetRootUser(
      authPrisma,
      serverPrisma,
      slugScopes,
    );
    rootSpinner.stop("Root user reset.");

    printSeedCredentials([{ result, serverRole }], { singular: true });
  } finally {
    await Promise.all([
      authPrisma.disconnect().catch(() => {}),
      serverPrisma.$disconnect().catch(() => {}),
    ]);
  }
}
