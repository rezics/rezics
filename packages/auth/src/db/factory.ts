import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const enableQueryLogging =
  (process.env.NODE_ENV ?? "development") !== "production" &&
  (process.env.DRIZZLE_LOG_QUERIES ?? "1") !== "0" &&
  (process.env.DRIZZLE_LOG_QUERIES ?? "1") !== "false";

export function createAuthDb(connectionString: string) {
  const pool = new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 2_000,
  });
  return {
    db: drizzle({
      client: pool,
      logger: enableQueryLogging
        ? {
            logQuery(query, params) {
              console.log("\n[Auth Drizzle Query]", query, params);
            },
          }
        : false,
    }),
    disconnect: () => pool.end(),
  };
}
