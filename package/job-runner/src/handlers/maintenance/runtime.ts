import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@rezics/server/prisma/generated/client";

export interface ServerPrismaRuntime {
  prisma: PrismaClient;
  disconnect(): Promise<void>;
}

export function createServerPrismaRuntime(options: {
  serverDatabaseUrl: string;
}): ServerPrismaRuntime {
  const adapter = new PrismaPg({
    connectionString: options.serverDatabaseUrl,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 2_000,
  });
  const prisma = new PrismaClient({ adapter });

  return {
    prisma,
    disconnect: () => prisma.$disconnect(),
  };
}
