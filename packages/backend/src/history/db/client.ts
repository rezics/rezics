import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { env } from "../env";

const Pool = (pg as any).Pool as new (options: {
  connectionString: string;
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
}) => any;

const enableQueryLogging =
  (process.env.NODE_ENV ?? "development") !== "production" &&
  (process.env.DRIZZLE_LOG_QUERIES ?? "1") !== "0" &&
  (process.env.DRIZZLE_LOG_QUERIES ?? "1") !== "false";

export const historyPool = new Pool({
  connectionString: env.HISTORY_DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 2_000,
});

export const db = drizzle({
  client: historyPool,
  logger: enableQueryLogging
    ? {
        logQuery(query, params) {
          console.log("\n[History Drizzle Query]", query, params);
        },
      }
    : false,
});

export type HistoryDb = typeof db;

export async function disconnectHistoryDb(): Promise<void> {
  await historyPool.end();
}

process.on("SIGTERM", async () => {
  await disconnectHistoryDb();
  process.exit(0);
});

process.on("SIGINT", async () => {
  await disconnectHistoryDb();
  process.exit(0);
});
