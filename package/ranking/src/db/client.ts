import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "../env";

const enableQueryLogging =
  (process.env.NODE_ENV ?? "development") !== "production" &&
  (process.env.DRIZZLE_LOG_QUERIES ?? "1") !== "0" &&
  (process.env.DRIZZLE_LOG_QUERIES ?? "1") !== "false";

export const rankingPool = new Pool({
  connectionString: env.RANKING_DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 2_000,
});

export const db = drizzle({
  client: rankingPool,
  logger: enableQueryLogging
    ? {
        logQuery(query, params) {
          console.log("\n[Ranking Drizzle Query]", query, params);
        },
      }
    : false,
});

export type RankingDb = typeof db;

export async function disconnectRankingDb(): Promise<void> {
  await rankingPool.end();
}

process.on("SIGTERM", async () => {
  await disconnectRankingDb();
  process.exit(0);
});

process.on("SIGINT", async () => {
  await disconnectRankingDb();
  process.exit(0);
});
