import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient as ServerPrismaClient } from "@rezics/server/prisma/generated/client";

export type { ServerPrismaClient };

export function createServerPrisma(
  connectionString: string,
): ServerPrismaClient {
  const adapter = new PrismaPg({ connectionString });
  return new ServerPrismaClient({ adapter });
}
