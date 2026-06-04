import type { ServerPrismaClient } from "../lib/prisma-factory";

export async function seedSlugScopes(prisma: ServerPrismaClient) {
  const { seedSlugScopes: seedServerSlugScopes } = await import(
    "@rezics/server/db/seed/infra/seed-slug-scopes"
  );
  return seedServerSlugScopes(prisma);
}

export async function seedInfra(
  prisma: ServerPrismaClient,
  rootUserId: string,
): Promise<void> {
  const { seedInfra: seedServerInfra } = await import(
    "@rezics/server/db/seed/infra/index"
  );
  await seedServerInfra(prisma, rootUserId);
}
