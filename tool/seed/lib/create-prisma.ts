import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient as AuthPrismaClient } from "../../../package/auth/prisma/generated/client";
import { PrismaClient as ServerPrismaClient } from "../../../package/server/prisma/generated/client";

export type { AuthPrismaClient, ServerPrismaClient };

export function createAuthPrisma(connectionString: string): AuthPrismaClient {
  const adapter = new PrismaPg({ connectionString });
  return new AuthPrismaClient({ adapter });
}

export function createServerPrisma(
  connectionString: string,
): ServerPrismaClient {
  const adapter = new PrismaPg({ connectionString });
  return new ServerPrismaClient({ adapter });
}
