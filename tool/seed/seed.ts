import "dotenv/config";
import * as p from "@clack/prompts";
import { seedInfra } from "../../package/server/prisma/seed/infra";
import { env } from "./env";
import { createAuthPrisma, createServerPrisma } from "./lib/create-prisma";
import { resolveRootUserId, seedAllUsers } from "./lib/seed-users";

type SeedTarget = "users" | "infra";

async function main() {
  p.intro("Rezics Seed");

  const targets = await p.multiselect<SeedTarget>({
    message: "What would you like to seed?",
    options: [
      { value: "users", label: "Users", hint: "root, admin, user, blocked" },
      {
        value: "infra",
        label: "Infrastructure",
        hint: "seed tags, default realm",
      },
    ],
  });

  if (p.isCancel(targets)) {
    p.cancel("Seed cancelled.");
    process.exit(0);
  }

  if (targets.length === 0) {
    p.cancel("Nothing selected.");
    process.exit(0);
  }

  const shouldSeedUsers = targets.includes("users");
  const shouldSeedInfra = targets.includes("infra");

  let overwrite = false;
  if (shouldSeedUsers) {
    const confirmOverwrite = await p.confirm({
      message:
        "Overwrite existing seed users? This will delete and re-create all 4 seed users.",
      initialValue: false,
    });

    if (p.isCancel(confirmOverwrite)) {
      p.cancel("Seed cancelled.");
      process.exit(0);
    }

    overwrite = confirmOverwrite;
  }

  const authPrisma = createAuthPrisma(env.AUTH_DATABASE_URL);
  const serverPrisma = createServerPrisma(env.SERVER_DATABASE_URL);

  try {
    let rootUserId: string | undefined;

    if (shouldSeedUsers) {
      const s = p.spinner();
      s.start(overwrite ? "Seeding users (overwrite)..." : "Seeding users...");

      const { rootUserId: id, results } = await seedAllUsers(
        authPrisma,
        serverPrisma,
        overwrite,
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

    if (shouldSeedInfra) {
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

    p.outro("Done!");
  } finally {
    await Promise.all([authPrisma.$disconnect(), serverPrisma.$disconnect()]);
  }
}

main().catch((err) => {
  p.log.error(String(err));
  process.exit(1);
});
