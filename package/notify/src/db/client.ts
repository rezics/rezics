import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "../env";

const enableQueryLogging =
  (process.env.NODE_ENV ?? "development") !== "production" &&
  (process.env.DRIZZLE_LOG_QUERIES ?? "1") !== "0" &&
  (process.env.DRIZZLE_LOG_QUERIES ?? "1") !== "false";

export const notifyPool = new Pool({
  connectionString: env.NOTIFY_DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 2_000,
});

export const db = drizzle({
  client: notifyPool,
  logger: enableQueryLogging
    ? {
        logQuery(query, params) {
          console.log("\n[Notify Drizzle Query]", query, params);
        },
      }
    : false,
});

export type NotifyDb = typeof db;

export async function disconnectNotifyDb(): Promise<void> {
  await notifyPool.end();
}

process.on("SIGTERM", async () => {
  await disconnectNotifyDb();
  process.exit(0);
});

process.on("SIGINT", async () => {
  await disconnectNotifyDb();
  process.exit(0);
});
