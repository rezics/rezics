import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "../src/env";
import { PrismaClient } from "./generated/client";

// Get database URL from environment variable
const databaseUrl = env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is not set");
}

// Prisma ORM v7 requires a driver adapter.
// Keep your pool config for performance + predictable timeouts.
const adapter = new PrismaPg({
  connectionString: databaseUrl,
  max: 20, // Maximum pool size
  idleTimeoutMillis: 30_000, // Close idle connections after 30s
  connectionTimeoutMillis: 2_000, // Acquire/connect timeout (pg default is 0 = no timeout)
});

// Enable query logging in development
const enableQueryEventLogging =
  (process.env.NODE_ENV ?? "development") !== "production" &&
  (process.env.PRISMA_LOG_QUERIES ?? "1") !== "0" &&
  (process.env.PRISMA_LOG_QUERIES ?? "1") !== "false";

// Initialize Prisma Client with PostgreSQL adapter
export const prisma = new PrismaClient({
  adapter,
  log: enableQueryEventLogging
    ? [{ emit: "event", level: "query" } as const]
    : [],
});

// Log queries in development
if (enableQueryEventLogging) {
  prisma.$on("query", (e) => {
    console.log(`\n[Prisma Query] ${e.duration}ms: ${e.query}`);
  });
}

// Handle graceful shutdown for Elysia
process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

export * from "./generated/client";
