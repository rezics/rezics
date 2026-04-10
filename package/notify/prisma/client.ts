import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "../src/env";
import { PrismaClient } from "./generated/client";

const adapter = new PrismaPg({
  connectionString: env.NOTIFY_DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 2_000,
});

const enableQueryEventLogging =
  (process.env.NODE_ENV ?? "development") !== "production" &&
  (process.env.PRISMA_LOG_QUERIES ?? "1") !== "0" &&
  (process.env.PRISMA_LOG_QUERIES ?? "1") !== "false";

export const prisma = new PrismaClient({
  adapter,
  log: enableQueryEventLogging
    ? [{ emit: "event", level: "query" } as const]
    : [],
});

if (enableQueryEventLogging) {
  prisma.$on("query", (e: any) => {
    console.log(`\n[Notify Prisma Query] ${e.duration}ms: ${e.query}`);
  });
}

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

export * from "./generated/client";
