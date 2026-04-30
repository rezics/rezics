import { getEnv } from "../lib/env";
import { createServerPrisma } from "../lib/prisma-factory";

export async function runDbCommand(argv: string[]): Promise<void> {
  const sub = argv[0];
  const rest = argv.slice(1);

  switch (sub) {
    case "reset":
      await runDbReset(rest);
      return;
    case "init-meili":
      await runInitMeili();
      return;
    default:
      console.error(
        `Unknown db subcommand "${sub ?? ""}". Available: reset, init-meili.`,
      );
      process.exit(2);
  }
}

async function runDbReset(argv: string[]): Promise<void> {
  const wipeAll = argv.includes("--all");
  const { resetDatabase, resetDatabasePreserveInfra } = await import(
    "@rezics/server/prisma/seed/database"
  );
  const env = getEnv();
  const prisma = createServerPrisma(env.SERVER_DATABASE_URL);

  try {
    if (wipeAll) {
      console.log("[Reset] Full wipe mode (--all)");
      await resetDatabase(prisma);
    } else {
      console.log("[Reset] Preserving infrastructure (default)");
      await resetDatabasePreserveInfra(prisma);
    }
  } finally {
    await prisma.$disconnect();
  }
}

async function runInitMeili(): Promise<void> {
  const { initMeiliSearch } = await import(
    "@rezics/server/prisma/seed/init-meili-search"
  );
  await initMeiliSearch();
}
