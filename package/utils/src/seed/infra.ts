import type { ServerDb } from "@rezics/server/db";
import type { ServerPrismaClient } from "../lib/prisma-factory";

export type ServerSeedDb = Pick<ServerDb, "select" | "transaction">;

export async function seedSlugScopes(db: ServerSeedDb) {
  const { seedSlugScopes: seedServerSlugScopes } = await import(
    "@rezics/server/db/seed/infra/seed-slug-scopes"
  );
  return seedServerSlugScopes(db);
}

export async function seedInfra(
  prisma: ServerPrismaClient,
  rootUserId: string,
  opts: {
    db: ServerSeedDb;
    slugScopes: Awaited<ReturnType<typeof seedSlugScopes>>;
  },
): Promise<void> {
  const { seedInfra: seedServerInfra } = await import(
    "@rezics/server/db/seed/infra/index"
  );
  await seedServerInfra(prisma, rootUserId, {
    db: opts.db,
    slugScopes: opts.slugScopes,
  });
}
