import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { generateDrizzleJson, generateMigration } from "drizzle-kit/api-postgres";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { Pool } from "pg";
import { connect } from "@nats-io/transport-node";
import { jetstream, jetstreamManager } from "@nats-io/jetstream";
import * as durability from "@rezics/schema/postgres/operations/operational-durability";
import * as runtime from "@rezics/schema/postgres/operations/operational-runtime";
import {
	catalogSourceRecord,
	catalogSourceSnapshot,
	catalogSourceMappingClaim,
	catalogSourceSubscription,
	catalogSourceCheckPlan,
	catalogSourceCheckReceipt,
} from "@rezics/schema/postgres/ingestion/source";
import { registerCatalogSourceRecord } from "../src/services/catalog/source-observations";
import { planSourceCheck } from "../src/services/catalog/source-scheduling";
import { configureOperationalBudget } from "../src/services/events/maintenance";
import { aggregateRoutingBucket } from "../src/services/events/envelope";
import {
	createSourceCheckHandler,
	scheduleSourceCheckTasks,
} from "../src/services/events/source-check-runtime";
import { relayOutboxBatch } from "../src/services/events/relay";
import { processDelivery } from "../src/services/events/consumer";
import { provisionTransport, type StreamRoute } from "../src/services/events/topology";
import { applyOperationalPartitions } from "./operational-partitions";

assert.equal(process.env.REZICS_DISPOSABLE_EVENT_FIXTURE, "1");
const url = new URL(process.env.DATABASE_URL ?? "");
assert.ok(
	["127.0.0.1", "localhost"].includes(url.hostname) &&
		url.pathname === "/rezics_atlas_source_runtime" &&
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
let stream: string | undefined;
const signal = new AbortController().signal;
try {
	assert.equal(
		(await pool.query("select to_regclass('operational_outbox') existing")).rows[0].existing,
		null,
		"Requires an empty target",
	);
	const schema = {
		...durability,
		...runtime,
		catalogSourceRecord,
		catalogSourceSnapshot,
		catalogSourceMappingClaim,
		catalogSourceSubscription,
		catalogSourceCheckPlan,
		catalogSourceCheckReceipt,
	};
	await pool.query(
		applyOperationalPartitions(
			await generateMigration(await generateDrizzleJson({}), await generateDrizzleJson(schema)),
		).join("\n"),
	);
	for (const name of ["operational-durability", "operational-runtime"])
		await pool.query(
			await readFile(
				new URL(`../src/services/database/schema/postgres/${name}.sql`, import.meta.url),
				"utf8",
			),
		);
	const key = { source: "qualification", objectType: "source_check", externalId: randomUUID() };
	const record = await db.transaction((tx) => registerCatalogSourceRecord(tx, key));
	const bucket = aggregateRoutingBucket("source_record", record.id);
	const route: StreamRoute = {
		class: "task",
		epoch: 1,
		bucket,
		maxBytes: 1048576,
		maxMessages: 1000,
		maxConsumers: 4,
		deployment: "qualification",
	};
	for (const lane of ["event-outbox", "task-outbox", "task-intent", "receipt"] as const)
		await db.transaction((tx) =>
			configureOperationalBudget(tx, {
				routingBucket: bucket,
				lane,
				maximumRows: 10000n,
				maximumBytes: 100000000n,
			}),
		);
	const snapshotId = randomUUID();
	const mappingKey = randomUUID();
	await db.transaction(async (tx) => {
		await tx.insert(catalogSourceSnapshot).values({
			sourceRecordId: record.id,
			id: snapshotId,
			contentSha256: "a".repeat(64),
			contractSha256: "b".repeat(64),
			payloadRef: "qualification:original",
		});
		await tx
			.update(catalogSourceRecord)
			.set({ headSnapshotId: snapshotId, lastCheckOutcome: "changed" })
			.where(eq(catalogSourceRecord.id, record.id));
		await tx.insert(catalogSourceMappingClaim).values({
			sourceRecordId: record.id,
			path: "root",
			mappingKey,
			owner: "software",
			observedSnapshotId: snapshotId,
		});
		await tx
			.insert(catalogSourceSubscription)
			.values({ sourceRecordId: record.id, mappingKey, owner: "software", state: "active" });
		await planSourceCheck(tx, {
			sourceRecordId: record.id,
			visibilityScope: "public",
			nextCheckAt: new Date(),
			intervalSeconds: 60,
		});
	});
	let acquired = 0;
	const handler = createSourceCheckHandler(db, route, async (lease) => {
		acquired++;
		assert.equal(lease.sourceRecordId, record.id);
		return { status: "unchanged" };
	});
	stream = await provisionTransport(manager, route, handler.durable, handler.kind);
	assert.equal(await scheduleSourceCheckTasks(db, route, signal), 1);
	assert.equal(await scheduleSourceCheckTasks(db, route, signal), 0);
	assert.equal(acquired, 0, "Admission must not perform network I/O");
	await relayOutboxBatch(db, js, [route], signal);
	const consumer = await js.consumers.get(stream, handler.durable);
	const message = await consumer.next({ expires: 1000 });
	assert.ok(message);
	const ack = message.ackAck.bind(message);
	message.ackAck = async () => false;
	await assert.rejects(() => processDelivery(message, handler, signal), /confirm/);
	message.ackAck = ack;
	await processDelivery(message, handler, signal);
	assert.equal(acquired, 1);
	assert.equal(
		(await pool.query("select count(*)::int n from catalog_source_check_receipt")).rows[0].n,
		1,
	);
	assert.equal(
		(await pool.query("select state from operational_task_intent")).rows[0].state,
		"succeeded",
	);
	await db.transaction((tx) =>
		planSourceCheck(tx, {
			sourceRecordId: record.id,
			visibilityScope: "public",
			nextCheckAt: new Date(),
			intervalSeconds: 60,
			expectedRevision: 1,
		}),
	);
	assert.equal(await scheduleSourceCheckTasks(db, route, signal), 1);
	await db
		.update(catalogSourceSubscription)
		.set({ state: "paused" })
		.where(eq(catalogSourceSubscription.sourceRecordId, record.id));
	await relayOutboxBatch(db, js, [route], signal);
	const cancelled = await consumer.next({ expires: 1000 });
	assert.ok(cancelled);
	await processDelivery(cancelled, handler, signal);
	assert.equal(acquired, 1, "Revoked demand must be checked before acquisition");
	assert.equal(
		(
			await pool.query(
				"select count(*)::int n from operational_task_intent where state='cancelled'",
			)
		).rows[0].n,
		1,
	);
	console.log(
		JSON.stringify(
			{
				checks: [
					"Due-plan claim and task admission commit atomically before acquisition",
					"NATS task delivery commits source receipt and terminal task together",
					"Lost ACK repeats neither acquisition nor source completion",
					"Subscription pause before execution cancels task without provider I/O",
				],
			},
			null,
			2,
		),
	);
} finally {
	if (stream) await manager.streams.delete(stream);
	await connection.drain();
	await pool.end();
}
