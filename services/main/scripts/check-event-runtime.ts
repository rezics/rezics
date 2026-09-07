import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { generateDrizzleJson, generateMigration } from "drizzle-kit/api-postgres";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { jetstream, jetstreamManager } from "@nats-io/jetstream";
import { connect } from "@nats-io/transport-node";
import * as durabilitySchema from "../src/services/database/schema/operational-durability";
import * as runtimeSchema from "../src/services/database/schema/operational-runtime";
import { applyOperationalPartitions } from "./operational-partitions";
import {
	appendOperationalOutbox,
	applyOperationalEvent,
	admitOperationalTask,
	parseTaskRequest,
} from "../src/services/events/durability";
import { configureOperationalBudget } from "../src/services/events/maintenance";
import { relayOutboxBatch } from "../src/services/events/relay";
import { disposeOperationalDelivery } from "../src/services/events/failure";
import { checkConsumerRetention } from "../src/services/events/checkpoint";
import { aggregateRoutingBucket, type EventEnvelope } from "../src/services/events/envelope";
import { provisionTransport, type StreamRoute } from "../src/services/events/topology";
import { processDelivery, type EventHandler } from "../src/services/events/consumer";

assert.equal(process.env.REZICS_DISPOSABLE_EVENT_FIXTURE, "1");
const url = new URL(process.env.DATABASE_URL ?? "");
assert.ok(
	["127.0.0.1", "localhost"].includes(url.hostname) &&
		url.pathname === "/rezics_atlas_runtime" &&
		url.search === "" &&
		url.hash === "",
);
const natsUrl = new URL(process.env.NATS_URL ?? "");
assert.ok(["127.0.0.1", "localhost"].includes(natsUrl.hostname));
const pool = new Pool({ connectionString: url.href, max: 8, statement_timeout: 10000 });
const db = drizzle({ client: pool });
const connection = await connect({ servers: natsUrl.href });
const manager = await jetstreamManager(connection);
const js = jetstream(connection);
const aggregate = { owner: "qualification", key: randomUUID(), revision: "1" };
const bucket = aggregateRoutingBucket(aggregate.owner, aggregate.key);
const route: StreamRoute = {
	class: "event",
	epoch: 1,
	bucket,
	maxBytes: 1048576,
	maxMessages: 1000,
	maxConsumers: 4,
	deployment: "qualification",
};
const taskRoute = { ...route, class: "task" as const };
const signal = new AbortController().signal;
const streams: string[] = [];
const checks: string[] = [];
function event(): EventEnvelope {
	return {
		version: 1,
		messageId: randomUUID(),
		class: "event",
		kind: "qualification.changed",
		occurredAt: new Date().toISOString(),
		correlationId: null,
		causationId: null,
		routingEpoch: 1,
		routingBucket: bucket,
		aggregate,
		payload: { value: 1 },
	};
}
try {
	assert.equal(
		(await pool.query("select to_regclass('operational_outbox') existing")).rows[0].existing,
		null,
		"Requires an empty target",
	);
	const ddl = applyOperationalPartitions(
		await generateMigration(
			await generateDrizzleJson({}),
			await generateDrizzleJson({ ...durabilitySchema, ...runtimeSchema }),
		),
	);
	await pool.query(ddl.join("\n"));
	for (const name of ["operational-durability", "operational-runtime"])
		await pool.query(
			await readFile(
				new URL(`../src/services/database/schema/postgres/${name}.sql`, import.meta.url),
				"utf8",
			),
		);
	await pool.query("create table operational_runtime_effect(id uuid primary key)");
	for (const lane of ["event-outbox", "task-outbox", "task-intent", "receipt"] as const)
		await db.transaction((tx) =>
			configureOperationalBudget(tx, {
				routingBucket: bucket,
				lane,
				maximumRows: 100000n,
				maximumBytes: 1000000000n,
			}),
		);
	const stream = await provisionTransport(manager, route, "apply", "qualification.changed");
	streams.push(stream);
	streams.push(await provisionTransport(manager, taskRoute, "execute", "qualification.execute"));
	const original = event();
	await db.transaction((tx) => appendOperationalOutbox(tx, [original]));
	assert.equal(
		(await pool.query("select count(*)::int n from operational_relay_pending")).rows[0].n,
		1,
	);
	await assert.rejects(() =>
		relayOutboxBatch(
			db,
			{
				publish: async (...args) => {
					await js.publish(...args);
					throw new Error("Simulated lost publication ACK");
				},
			},
			[route],
			signal,
		),
	);
	assert.equal(
		(await pool.query("select count(*)::int n from operational_relay_pending")).rows[0].n,
		1,
	);
	assert.equal(await relayOutboxBatch(db, js, [route], signal), 1);
	assert.equal((await manager.streams.info(stream)).state.messages, 1);
	checks.push(
		"Lost publish ACK retains exact pending row; restart deduplicates publication and removes it only after confirmed ACK",
	);
	const consumer = await js.consumers.get(stream, "apply");
	const handler: EventHandler<unknown> = {
		route,
		durable: "apply",
		kind: "qualification.changed",
		parsePayload: (value) => value,
		dispose: (failure, workSignal) => disposeOperationalDelivery(db, route, failure, workSignal),
		apply: ({ envelope }) =>
			db.transaction((tx) =>
				applyOperationalEvent(
					tx,
					{
						routingBucket: bucket,
						consumerKey: "qualification.apply",
						operationId: envelope.messageId,
						requestFingerprint: createHash("sha256").update(JSON.stringify(envelope)).digest("hex"),
					},
					async (tx) => {
						await tx.execute(
							sql`insert into operational_runtime_effect(id) values (${envelope.messageId})`,
						);
					},
				),
			),
	};
	await checkConsumerRetention(db, manager, route, "apply");
	const first = await consumer.next({ expires: 1000 });
	assert.ok(first);
	const actualAck = first.ackAck.bind(first);
	first.ackAck = async () => false;
	await assert.rejects(() => processDelivery(first, handler, signal), /confirm/);
	first.ackAck = actualAck;
	await processDelivery(first, handler, signal);
	assert.equal(
		(await pool.query("select count(*)::int n from operational_runtime_effect")).rows[0].n,
		1,
	);
	checks.push("Commit before lost consumer ACK; duplicate delivery produces one persisted effect");
	await checkConsumerRetention(db, manager, route, "apply");
	const task: EventEnvelope = {
		...event(),
		class: "task",
		kind: "qualification.execute",
		payload: {
			operationId: randomUUID(),
			consumerKey: "qualification.execute",
			maximumAttempts: 3,
			deadline: new Date(Date.now() + 3600000).toISOString(),
		},
	};
	await db.transaction((tx) => admitOperationalTask(tx, task));
	const failed = await disposeOperationalDelivery(
		db,
		taskRoute,
		{
			delivery: {
				stream: streams[1]!,
				consumer: "execute",
				sequence: 1,
				deliveryCount: 99,
				payloadSha256: "a".repeat(64),
			},
			envelope: task,
			reason: "retry_exhausted",
			detail: "exhausted",
		},
		signal,
	);
	assert.equal(failed.status, "terminal");
	assert.equal(
		(
			await pool.query("select state from operational_task_intent where operation_id=$1", [
				parseTaskRequest(task).identity.operationId,
			])
		).rows[0].state,
		"failed",
	);
	checks.push(
		"Exhausted transport delivery claims the exact admitted task, fences it, and persists failed receipt",
	);
	const invalid = {
		delivery: {
			stream,
			consumer: "apply",
			sequence: 55,
			deliveryCount: 1,
			payloadSha256: "b".repeat(64),
		},
		envelope: null,
		reason: "invalid_message" as const,
		detail: "invalid",
	};
	const quarantine = await disposeOperationalDelivery(db, route, invalid, signal);
	const duplicate = await disposeOperationalDelivery(db, route, invalid, signal);
	assert.ok("receiptId" in quarantine && "receiptId" in duplicate);
	assert.equal(quarantine.receiptId, duplicate.receiptId);
	assert.equal(duplicate.status, "duplicate");
	checks.push(
		"Malformed-message quarantine is bounded and durably deduplicated without trusting body IDs",
	);
	await pool.query(
		"update operational_consumer_checkpoint set stream_created_at='replaced' where consumer_key='apply'",
	);
	await assert.rejects(() => checkConsumerRetention(db, manager, route, "apply"), /replay/);
	assert.equal(
		(
			await pool.query(
				"select state from operational_consumer_checkpoint where consumer_key='apply'",
			)
		).rows[0].state,
		"replay_required",
	);
	checks.push("Stream recreation persists replay-required state and prevents further delivery");
	for (let batch = 0; batch < 12; batch++)
		await pool.query(
			`
 insert into operational_outbox(routing_bucket,message_id,message_class,kind,routing_epoch,subject,aggregate_key,occurred_at,payload,serialized_envelope)
 select $1,id,'event','qualification.changed',1,$2,$3,$4::timestamptz,body,body::text
 from (select id,jsonb_set($5::jsonb,'{messageId}',to_jsonb(id::text)) body from (select gen_random_uuid() id from generate_series(1,1000)) ids) documents`,
			[
				bucket,
				`rezics.events.e1.b${bucket}.qualification.changed`,
				aggregate.key,
				original.occurredAt,
				JSON.stringify(original),
			],
		);
	await pool.query("analyze operational_relay_pending");
	await pool.query("analyze operational_outbox");
	const plan = (
		await pool.query(
			`explain (analyze,buffers,format json) select p.message_id,o.serialized_envelope from operational_relay_pending p join operational_outbox o using(routing_bucket,message_id) where p.routing_bucket=$1 and p.message_class='event' and p.routing_epoch=1 order by p.created_at,p.message_id limit 4 for update of p skip locked`,
			[bucket],
		)
	).rows[0]["QUERY PLAN"];
	function hasPendingIndex(value: unknown): boolean {
		if (value === null || typeof value !== "object") return false;
		if (
			"Node Type" in value &&
			value["Node Type"] === "Index Scan" &&
			"Relation Name" in value &&
			typeof value["Relation Name"] === "string" &&
			value["Relation Name"].startsWith("operational_relay_pending") &&
			"Index Cond" in value &&
			typeof value["Index Cond"] === "string" &&
			["routing_bucket", "message_class", "routing_epoch"].every((key) =>
				String(value["Index Cond"]).includes(key),
			)
		)
			return true;
		return Object.values(value).some(hasPendingIndex);
	}
	assert.ok(hasPendingIndex(plan));
	const sizes = (
		await pool.query(
			`select c.relname,pg_total_relation_size(c.oid)::text bytes from pg_class c where c.relname in ('operational_relay_pending')`,
		)
	).rows;
	checks.push(
		"12,000 same-bucket pending envelopes use the selective relay index with bounded LIMIT/SKIP LOCKED",
	);
	console.log(JSON.stringify({ bucket, checks, plan, sizes }, null, 2));
} finally {
	for (const stream of streams) await manager.streams.delete(stream);
	await connection.drain();
	await pool.end();
}
