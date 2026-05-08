import * as p from "@clack/prompts";
import { getEnv } from "../lib/env";
import {
  type AuthPrismaClient,
  createAuthPrisma,
  createServerPrisma,
  type ServerPrismaClient,
} from "../lib/prisma-factory";
import { seedInfra } from "./infra";
import {
  resolveRootUserId,
  seedAllAuthUsers,
  seedAllMainUsers,
} from "./users";

export interface RunSeedOptions {
  seedUsers?: boolean;
  seedInfra?: boolean;
  overwriteUsers?: boolean;
}

export async function runSeed(opts: RunSeedOptions): Promise<void> {
  const env = getEnv();
  const authPrisma: AuthPrismaClient = createAuthPrisma(env.AUTH_DATABASE_URL);
  const serverPrisma: ServerPrismaClient = createServerPrisma(
    env.SERVER_DATABASE_URL,
  );

  try {
    let rootUserId: string | undefined;

    if (opts.seedUsers) {
      const s = p.spinner();
      s.start(
        opts.overwriteUsers
          ? "Seeding users (overwrite)..."
          : "Seeding users...",
      );

      const authResults = await seedAllAuthUsers(
        authPrisma,
        !!opts.overwriteUsers,
        serverPrisma,
      );
      const { rootUserId: id, results } = await seedAllMainUsers(
        serverPrisma,
        authResults,
      );
      rootUserId = id;

      s.stop("Users seeded.");

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
    }

    if (opts.seedInfra) {
      if (!rootUserId) {
        const s = p.spinner();
        s.start("Resolving root user...");
        rootUserId =
          (await resolveRootUserId(authPrisma, serverPrisma)) ?? undefined;
        s.stop(rootUserId ? "Root user found." : "Root user not found.");
      }

      if (!rootUserId) {
        p.log.error(
          "Root user (root@rezics.com) not found.\nPlease seed Users first, or select both.",
        );
        p.cancel("Cannot seed infrastructure without a root user.");
        process.exit(1);
      }

      const s = p.spinner();
      s.start("Seeding infrastructure...");

      await seedInfra(serverPrisma, rootUserId);

      s.stop("Infrastructure seeded.");
    }
  } finally {
    await Promise.all([
      authPrisma.$disconnect().catch(() => {}),
      serverPrisma.$disconnect().catch(() => {}),
    ]);
  }
}
