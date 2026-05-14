import * as p from "@clack/prompts";
import { resetAuthDatabase } from "@rezics/auth/prisma/seed";
import { resetDatabase } from "@rezics/server/prisma/seed/database";
import { getEnv } from "../lib/env";
import {
  type AuthPrismaClient,
  createAuthPrisma,
  createServerPrisma,
  type ServerPrismaClient,
} from "../lib/prisma-factory";
import { seedInfra } from "./infra";
import { resetRootUser, seedAllAuthUsers, seedAllMainUsers } from "./users";

export interface RunSeedOptions {
  resetDatabases?: boolean;
}

export async function seedBaseline(
  authPrisma: AuthPrismaClient,
  serverPrisma: ServerPrismaClient,
  opts: RunSeedOptions = {},
): Promise<void> {
  const resetDatabases = opts.resetDatabases ?? true;

  if (resetDatabases) {
    const s = p.spinner();
    s.start("Resetting auth and server databases...");
    await resetDatabase(serverPrisma);
    await resetAuthDatabase(authPrisma);
    s.stop("Databases reset.");
  }

  const userSpinner = p.spinner();
  userSpinner.start("Seeding users...");

  const authResults = await seedAllAuthUsers(authPrisma);
  const { rootUserId, results } = await seedAllMainUsers(
    serverPrisma,
    authResults,
  );

  userSpinner.stop("Users seeded.");

  for (const { result, serverRole } of results) {
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

  p.log.warn("Store these passwords securely.");

  const infraSpinner = p.spinner();
  infraSpinner.start("Seeding infrastructure...");
  await seedInfra(serverPrisma, rootUserId);
  infraSpinner.stop("Infrastructure seeded.");
}

export async function runSeed(opts: RunSeedOptions = {}): Promise<void> {
  const env = getEnv();
  const authPrisma: AuthPrismaClient = createAuthPrisma(env.AUTH_DATABASE_URL);
  const serverPrisma: ServerPrismaClient = createServerPrisma(
    env.SERVER_DATABASE_URL,
  );

  try {
    await seedBaseline(authPrisma, serverPrisma, opts);
  } finally {
    await Promise.all([
      authPrisma.$disconnect().catch(() => {}),
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
    s.start("Resetting root user...");
    const { result, serverRole } = await resetRootUser(
      authPrisma,
      serverPrisma,
    );
    s.stop("Root user reset.");

    p.log.info(
      [
        `${result.name} <${result.email}>`,
        `  Role: ${result.role} (auth) / ${serverRole} (server)`,
        `  Slug: ${result.slug}`,
        `  ID:   ${result.userId}`,
        `  Pass: ${result.password}`,
      ].join("\n"),
    );
    p.log.warn("Store this password securely.");
  } finally {
    await Promise.all([
      authPrisma.$disconnect().catch(() => {}),
      serverPrisma.$disconnect().catch(() => {}),
    ]);
  }
}
