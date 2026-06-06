import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { relations } from "./schema";

const enableQueryLogging =
  (process.env.NODE_ENV ?? "development") !== "production" &&
  (process.env.DRIZZLE_LOG_QUERIES ?? "1") !== "0" &&
  (process.env.DRIZZLE_LOG_QUERIES ?? "1") !== "false";

export function createServerDb(connectionString: string, max = 20) {
  const pool = new Pool({
    connectionString,
    max,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 2_000,
  });
  return {
    db: drizzle({
      client: pool,
      relations,
      logger: enableQueryLogging
        ? {
            logQuery(query, params) {
              console.log("\n[Server Drizzle Query]", query, params);
            },
          }
        : false,
    }),
    disconnect: () => pool.end(),
  };
}
