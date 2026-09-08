import { jetstream, jetstreamManager } from "@nats-io/jetstream";
import { connect } from "@nats-io/transport-node";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { serve } from "srvx";
import { z } from "zod";
import { acquireCatalogSourceCheck } from "./services/catalog/source-acquisition";
import {
	createSourceCheckHandler,
	scheduleSourceCheckTasks,
} from "./services/events/source-check-runtime";
import { createSourceHandlers } from "./services/catalog/source-runtime";
import { createMusicReleaseSourceHandlers } from "./services/catalog/music-release-source-jobs";
import { parseEventWorkerConfig } from "./services/events/config";
import { disposeOperationalDelivery } from "./services/events/failure";
import { relayOutboxBatch } from "./services/events/relay";
import { EventWorkerHealth, runEventConsumer, runEventLane } from "./services/events/runtime";
import { provisionTransport, type StreamRoute } from "./services/events/topology";

const config = parseEventWorkerConfig(process.env);
const databaseUrl = z.url().parse(process.env.DATABASE_URL);
if (!["postgres:", "postgresql:"].includes(new URL(databaseUrl).protocol))
	throw new TypeError("DATABASE_URL must address PostgreSQL");
const pool = new Pool({
	connectionString: databaseUrl,
	max: 8,
	connectionTimeoutMillis: 5000,
	statement_timeout: 10000,
	idleTimeoutMillis: 30000,
});
const database = drizzle({ client: pool });
const health = new EventWorkerHealth();
const shutdown = new AbortController();
const requestShutdown = () => shutdown.abort();
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, requestShutdown);
const connection = await connect({
	servers: config.NATS_URL,
	name: "rezics-event-worker",
	timeout: 5000,
	maxReconnectAttempts: 10,
	reconnectTimeWait: 1000,
});
const manager = await jetstreamManager(connection);
const client = jetstream(connection);
const server = serve({
	hostname: config.EVENT_WORKER_HEALTH_HOST,
	port: config.EVENT_WORKER_HEALTH_PORT,
	fetch(request) {
		const path = new URL(request.url).pathname;
		if (path !== "/health/live" && path !== "/health/ready")
			return new Response(null, { status: 404 });
		const state = health.snapshot();
		return Response.json(state, {
			status: !shutdown.signal.aborted && (path === "/health/live" || state.ready) ? 200 : 503,
		});
	},
});
const routes: StreamRoute[] = config.EVENT_WORKER_BUCKETS.flatMap((bucket) =>
	(["event", "task"] as const).map((messageClass) => ({
		class: messageClass,
		bucket,
		epoch: config.EVENT_WORKER_EPOCH,
		maxBytes: config.EVENT_WORKER_STREAM_BYTES,
		maxMessages: config.EVENT_WORKER_STREAM_MESSAGES,
		maxConsumers: 8,
		deployment: config.EVENT_WORKER_DEPLOYMENT,
	})),
);
const active: Promise<void>[] = [];
try {
	for (const route of routes) {
		const handlers = createSourceHandlers(database, route, (failure, signal) =>
			disposeOperationalDelivery(database, route, failure, signal),
		);
		if (route.class === "task")
			handlers.push(createSourceCheckHandler(database, route, acquireCatalogSourceCheck));
		handlers.push(...createMusicReleaseSourceHandlers(database, route, (failure, signal) =>
			disposeOperationalDelivery(database, route, failure, signal),
		));
		for (const handler of handlers) {
			const stream = await provisionTransport(manager, route, handler.durable, handler.kind);
			const consumer = await client.consumers.get(stream, handler.durable);
			active.push(
				runEventConsumer({ database, manager, consumer, handler, health, signal: shutdown.signal }),
			);
		}
	}
	for (const route of routes.filter((route) => route.class === "task"))
		active.push(
			runEventLane(
				`source-scheduler.${route.bucket}`,
				() => scheduleSourceCheckTasks(database, route, shutdown.signal),
				health,
				shutdown.signal,
				config.EVENT_WORKER_POLL_MS,
			),
		);
	if (config.EVENT_WORKER_RELAY === "sql")
		active.push(
			runEventLane(
				"outbox-relay",
				() => relayOutboxBatch(database, client, routes, shutdown.signal),
				health,
				shutdown.signal,
				config.EVENT_WORKER_POLL_MS,
			),
		);
	if (active.length === 0) throw new Error("No executable event handlers configured");
	health.start();
	await Promise.all(active);
} finally {
	shutdown.abort();
	await Promise.allSettled(active);
	await connection.drain();
	await server.close();
	await pool.end();
	for (const signal of ["SIGINT", "SIGTERM"] as const) process.off(signal, requestShutdown);
}
