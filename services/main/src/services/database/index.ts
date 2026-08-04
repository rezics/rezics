import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { instrumentPostgresClient, peekActiveObservability } from "@rezics/observability";

import { env } from "../config";

const pool = new Pool({
	connectionString: env.DATABASE_URL,
	max: env.DATABASE_POOL_MAX,
	connectionTimeoutMillis: env.DATABASE_POOL_CONNECTION_TIMEOUT_MS,
	idleTimeoutMillis: env.DATABASE_POOL_IDLE_TIMEOUT_MS,
	maxLifetimeSeconds: env.DATABASE_POOL_MAX_LIFETIME_SECONDS,
	statement_timeout: env.DATABASE_STATEMENT_TIMEOUT_MS,
});
peekActiveObservability()?.metrics.registerDatabasePool(() => ({
	total: pool.totalCount,
	idle: pool.idleCount,
	waiting: pool.waitingCount,
}));
const databaseClient = instrumentPostgresClient(pool);

export const database = drizzle({ client: databaseClient });

/**
 * A transaction owns one PostgreSQL client. Await every database operation on
 * this executor before starting the next one; a single client cannot execute
 * concurrent queries.
 */
export type DatabaseTransaction = Parameters<Parameters<typeof database.transaction>[0]>[0];
export type DatabaseExecutor = typeof database | DatabaseTransaction;
