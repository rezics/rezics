import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "../env";

const enableQueryLogging =
  (process.env.NODE_ENV ?? "development") !== "production" &&
  (process.env.DRIZZLE_LOG_QUERIES ?? "1") !== "0" &&
  (process.env.DRIZZLE_LOG_QUERIES ?? "1") !== "false";

export const reactionPool = new Pool({
  connectionString: env.REACTION_DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 2_000,
});

export const db = drizzle({
  client: reactionPool,
  logger: enableQueryLogging
    ? {
        logQuery(query, params) {
          console.log("\n[Reaction Drizzle Query]", query, params);
        },
      }
    : false,
});

export type ReactionDb = typeof db;

export async function disconnectReactionDb(): Promise<void> {
  await reactionPool.end();
}

process.on("SIGTERM", async () => {
  await disconnectReactionDb();
  process.exit(0);
});

process.on("SIGINT", async () => {
  await disconnectReactionDb();
  process.exit(0);
});
