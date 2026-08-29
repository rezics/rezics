import { AsyncLocalStorage } from "node:async_hooks";

import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { Pool, type PoolClient } from "pg";
import { instrumentPostgresClient, peekActiveObservability } from "@rezics/observability";

import { env } from "../config";
import { DatabasePoolWaitTracker } from "./pool-wait";

const pool = new Pool({
	connectionString: env.DATABASE_URL,
	max: env.DATABASE_POOL_MAX,
	connectionTimeoutMillis: env.DATABASE_POOL_CONNECTION_TIMEOUT_MS,
	idleTimeoutMillis: env.DATABASE_POOL_IDLE_TIMEOUT_MS,
	maxLifetimeSeconds: env.DATABASE_POOL_MAX_LIFETIME_SECONDS,
	statement_timeout: env.DATABASE_STATEMENT_TIMEOUT_MS,
});
const databasePoolWaitTracker = new DatabasePoolWaitTracker();
const untrackedPoolConnect = pool.connect.bind(pool);

function trackedPoolConnect(): Promise<PoolClient>;
function trackedPoolConnect(
	callback: (
		error: Error | undefined,
		client: PoolClient | undefined,
		done: (release?: unknown) => void,
	) => void,
): void;
function trackedPoolConnect(
	callback?: (
		error: Error | undefined,
		client: PoolClient | undefined,
		done: (release?: unknown) => void,
	) => void,
): Promise<PoolClient> | void {
	const startedAt = performance.now();
	const record = () => databasePoolWaitTracker.record(Math.max(0, performance.now() - startedAt));
	if (callback) {
		untrackedPoolConnect((error, client, done) => {
			record();
			callback(error, client, done);
		});
		return;
	}
	return untrackedPoolConnect().then(
		(client) => {
			record();
			return client;
		},
		(error: unknown) => {
			record();
			throw error;
		},
	);
}

pool.connect = trackedPoolConnect;
peekActiveObservability()?.metrics.registerDatabasePool(() => ({
	total: pool.totalCount,
	idle: pool.idleCount,
	waiting: pool.waitingCount,
}));
const databaseClient = instrumentPostgresClient(pool);

const rootDatabase = drizzle({ client: databaseClient });
export type DatabaseTransaction = Parameters<Parameters<typeof rootDatabase.transaction>[0]>[0];
export type DatabaseExecutor = typeof rootDatabase | DatabaseTransaction;
const databaseExecutorStorage = new AsyncLocalStorage<DatabaseTransaction>();

/**
 * Route existing service calls through a request-local transaction when one is
 * installed. Outside that narrow scope this is the ordinary pooled database.
 */
export const database = new Proxy(rootDatabase, {
	get(target, property) {
		const executor = databaseExecutorStorage.getStore() ?? target;
		const value = Reflect.get(executor, property, executor);
		return typeof value === "function" ? value.bind(executor) : value;
	},
}) as typeof rootDatabase;
export type DatabaseSession = NodePgDatabase;

/** Current process-local p95 client-acquisition wait over the last minute. */
export function databasePoolWaitP95Milliseconds(): number {
	return databasePoolWaitTracker.p95Milliseconds();
}

/**
 * Runs all database calls made by work on one transaction with a hard total
 * lifetime. The slightly shorter statement timeout normally cancels one slow
 * statement without discarding the connection; transaction_timeout remains the
 * backstop for several individually fast statements or idle application work.
 */
export async function withDatabaseTransactionDeadline<T>(
	maximumMilliseconds: number,
	work: () => Promise<T>,
): Promise<T> {
	if (!Number.isSafeInteger(maximumMilliseconds) || maximumMilliseconds < 2)
		throw new RangeError("Database transaction deadline must be at least two milliseconds");
	const statementMilliseconds = maximumMilliseconds - 1;
	return rootDatabase.transaction(async (tx) => {
		await tx.execute(sql`select
			set_config('statement_timeout', ${String(statementMilliseconds)}, true),
			set_config('transaction_timeout', ${String(maximumMilliseconds)}, true)`);
		return databaseExecutorStorage.run(tx, work);
	});
}

/** Runs work on one PostgreSQL session, preserving session-scoped locks across transactions. */
export async function withDatabaseSession<T>(
	work: (session: DatabaseSession) => Promise<T>,
): Promise<T> {
	const client = await pool.connect();
	try {
		return await work(drizzle({ client: instrumentPostgresClient(client) }));
	} finally {
		client.release();
	}
}

/**
 * A transaction owns one PostgreSQL client. Await every database operation on
 * this executor before starting the next one; a single client cannot execute
 * concurrent queries.
 */
