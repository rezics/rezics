import { getEnv } from "../lib/env";
import { createAuthPrisma, createServerPrisma } from "../lib/prisma-factory";

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

async function runDbReset(_argv: string[]): Promise<void> {
  const { resetDatabase } = await import("@rezics/server/prisma/seed/database");
  const { resetAuthDatabase } = await import("@rezics/auth/prisma/seed");
  const env = getEnv();
  const serverPrisma = createServerPrisma(env.SERVER_DATABASE_URL);
  const authPrisma = createAuthPrisma(env.AUTH_DATABASE_URL);

  try {
    console.log("[Reset] Full wipe mode");
    await resetDatabase(serverPrisma);
    await resetAuthDatabase(authPrisma);
  } finally {
    await Promise.all([
      serverPrisma.$disconnect().catch(() => {}),
      authPrisma.$disconnect().catch(() => {}),
    ]);
  }
}

async function runInitMeili(): Promise<void> {
  const { initMeiliSearch } = await import(
    "@rezics/server/prisma/seed/init-meili-search"
  );
  await initMeiliSearch();
}
