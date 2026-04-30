import type { ServerPrismaClient } from "../lib/prisma-factory";

export async function seedInfra(
  prisma: ServerPrismaClient,
  rootUserId: string,
): Promise<void> {
  const { seedInfra: seedServerInfra } = await import(
    "@rezics/server/prisma/seed/infra/index"
  );
  await seedServerInfra(prisma, rootUserId);
}
