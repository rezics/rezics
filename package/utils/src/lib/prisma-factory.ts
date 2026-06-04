import { PrismaPg } from "@prisma/adapter-pg";
import { createAuthDb } from "@rezics/auth/db/factory";
import { PrismaClient as ServerPrismaClient } from "@rezics/server/prisma/generated/client";

export type AuthPrismaClient = ReturnType<typeof createAuthDb>;
export type { ServerPrismaClient };

export function createAuthPrisma(connectionString: string): AuthPrismaClient {
  return createAuthDb(connectionString);
}

export function createServerPrisma(
  connectionString: string,
): ServerPrismaClient {
  const adapter = new PrismaPg({ connectionString });
  return new ServerPrismaClient({ adapter });
}
