import type { ServerDb } from "@rezics/server/db";
import type { SeedSyncHooks } from "@rezics/server/db/seed-factory";

export type ServerSeedDb = Pick<
  ServerDb,
  "insert" | "select" | "transaction" | "update"
>;

export async function seedSlugScopes(db: ServerSeedDb) {
  const { seedSlugScopes: seedServerSlugScopes } = await import(
    "@rezics/server/db/seed/infra/seed-slug-scopes"
  );
  return seedServerSlugScopes(db);
}

export async function seedInfra(
  rootUserId: string,
  opts: {
    db: ServerSeedDb;
    slugScopes: Awaited<ReturnType<typeof seedSlugScopes>>;
    sync?: SeedSyncHooks;
  },
): Promise<void> {
  const { seedInfra: seedServerInfra } = await import(
    "@rezics/server/db/seed/infra/index"
  );
  await seedServerInfra(rootUserId, {
    db: opts.db,
    slugScopes: opts.slugScopes,
    sync: opts.sync,
  });
}
