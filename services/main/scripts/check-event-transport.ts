import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { jetstream, jetstreamManager } from "@nats-io/jetstream";
import { connect } from "@nats-io/transport-node";
import { z } from "zod";
import { consumeBatch, type EventHandler } from "../src/services/events/consumer";
import {
	aggregateRoutingBucket,
	encodeEnvelope,
	envelopeSubject,
	type EventEnvelope,
} from "../src/services/events/envelope";
import { publishEnvelope } from "../src/services/events/publisher";
import {
	provisionTransport,
	streamConfig,
	type StreamRoute,
} from "../src/services/events/topology";

// An explicit disposable endpoint is required: this harness creates and deletes streams.
assert.equal(process.env.REZICS_DISPOSABLE_EVENT_FIXTURE, "1");
const url = new URL(process.env.NATS_URL ?? "nats://127.0.0.1:14222");
assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(url.hostname));
assert.equal(url.protocol, "nats:");
const connection = await connect({ servers: url.toString(), reconnect: false, timeout: 3_000 });
const manager = await jetstreamManager(connection);
const client = jetstream(connection);
const epoch = Date.now();
const aggregate = { owner: "transport-fixture", key: randomUUID(), revision: "1" };
const bucket = aggregateRoutingBucket(aggregate.owner, aggregate.key);
const baseRoute = {
	epoch,
	bucket,
	maxBytes: 1024 * 1024,
	maxMessages: 100,
	maxConsumers: 4,
	deployment: "qualification",
} as const;
const eventRoute: StreamRoute = { ...baseRoute, class: "event" };
const taskRoute: StreamRoute = { ...baseRoute, class: "task" };
const streams: string[] = [];
const kind = "transport.check";
const signal = new AbortController().signal;
const makeEnvelope = (messageClass: "event" | "task"): EventEnvelope => ({
	version: 1,
	messageId: randomUUID(),
	class: messageClass,
	kind,
	occurredAt: new Date().toISOString(),
	correlationId: null,
	causationId: null,
	routingEpoch: epoch,
	routingBucket: bucket,
	aggregate,
	payload: { fixture: true },
});
const makeHandler = (route: StreamRoute, durable: string): EventHandler<{ fixture: true }> => ({
	route,
	durable,
	kind,
	parsePayload: (value) => z.strictObject({ fixture: z.literal(true) }).parse(value),
	// Synthetic callbacks isolate broker behavior; these are not database receipt evidence.
	apply: async () => ({ status: "committed", receiptId: "synthetic-receipt" }),
	dispose: async () => ({ status: "terminal", receiptId: "synthetic-failure" }),
});

try {
	for (const route of [eventRoute, taskRoute]) {
		streams.push(streamConfig(route).name);
		await provisionTransport(manager, route, "first", kind);
		await provisionTransport(manager, route, "first", kind);
	}
	await assert.rejects(
		() => provisionTransport(manager, { ...eventRoute, maxBytes: 2 * 1024 * 1024 }, "first", kind),
		/configuration mismatch/,
	);
	await provisionTransport(manager, eventRoute, "second", kind);
	await assert.rejects(() => provisionTransport(manager, taskRoute, "overlapping", kind));

	const event = makeEnvelope("event");
	const firstAck = await publishEnvelope(client, eventRoute, event);
	const duplicateAck = await publishEnvelope(client, eventRoute, event);
	assert.equal(duplicateAck.duplicate, true);
	assert.equal(duplicateAck.seq, firstAck.seq);
	for (const durable of ["first", "second"]) {
		const consumer = await client.consumers.get(streamConfig(eventRoute).name, durable);
		assert.equal(await consumeBatch(consumer, makeHandler(eventRoute, durable), signal), 1);
	}
	assert.equal((await manager.streams.info(streamConfig(eventRoute).name)).state.messages, 1);

	const taskConsumer = await client.consumers.get(streamConfig(taskRoute).name, "first");
	await publishEnvelope(client, taskRoute, makeEnvelope("task"));
	let attempts = 0;
	const retryHandler = makeHandler(taskRoute, "first");
	retryHandler.apply = async () => {
		attempts++;
		return attempts === 1
			? { status: "retry", delayMs: 500 }
			: { status: "committed", receiptId: "synthetic-retry-receipt" };
	};
	for (let batch = 0; batch < 4 && attempts < 2; batch++)
		await consumeBatch(taskConsumer, retryHandler, signal);
	assert.equal(attempts, 2);
	assert.equal((await manager.streams.info(streamConfig(taskRoute).name)).state.messages, 0);

	for (let i = 0; i < 12; i++) await publishEnvelope(client, taskRoute, makeEnvelope("task"));
	let active = 0;
	let maximumActive = 0;
	let completed = 0;
	const concurrentHandler = makeHandler(taskRoute, "first");
	concurrentHandler.apply = async () => {
		active++;
		maximumActive = Math.max(maximumActive, active);
		await new Promise((resolve) => setTimeout(resolve, 10));
		active--;
		completed++;
		return { status: "committed", receiptId: "synthetic-concurrency-receipt" };
	};
	await consumeBatch(taskConsumer, concurrentHandler, signal);
	assert.equal(completed, 12);
	assert.equal(maximumActive, 4);
	assert.equal(active, 0);

	const poison = makeEnvelope("task");
	await client.publish(envelopeSubject(poison), new TextEncoder().encode("not-json"));
	let disposed = false;
	const poisonHandler = makeHandler(taskRoute, "first");
	poisonHandler.dispose = async (failure) => {
		assert.equal(failure.reason, "invalid_message");
		assert.equal(failure.envelope, null);
		assert.match(failure.delivery.payloadSha256, /^[a-f0-9]{64}$/);
		disposed = true;
		return { status: "terminal", receiptId: "synthetic-poison-receipt" };
	};
	await consumeBatch(taskConsumer, poisonHandler, signal);
	assert.ok(disposed);
	assert.equal((await manager.streams.info(streamConfig(taskRoute).name)).state.messages, 0);

	const bounded: StreamRoute = { ...taskRoute, epoch: epoch + 1, maxMessages: 1 };
	streams.push(streamConfig(bounded).name);
	await provisionTransport(manager, bounded, "first", kind);
	const boundedTask = { ...makeEnvelope("task"), routingEpoch: bounded.epoch };
	await publishEnvelope(client, bounded, boundedTask);
	await assert.rejects(() =>
		publishEnvelope(client, bounded, { ...boundedTask, messageId: randomUUID() }),
	);
	assert.equal((await manager.streams.info(streamConfig(bounded).name)).state.messages, 1);
	assert.ok(encodeEnvelope(event).byteLength < 64 * 1024);
	console.log(
		JSON.stringify(
			{
				status: "passed",
				broker: connection.info?.version,
				checks: [
					"idempotent-provision",
					"drift-rejection",
					"nonoverlapping-task-filter",
					"publish-dedup-ack",
					"independent-event-consumers",
					"event-retention-after-ack",
					"task-retry-removal",
					"bounded-concurrency",
					"poison-disposition",
					"discard-new-backpressure",
				],
				qualification: "single-node transport only; synthetic outcomes, no DB/CDC or HA claim",
			},
			null,
			2,
		),
	);
} finally {
	for (const stream of streams) await manager.streams.delete(stream).catch(() => undefined);
	await connection.close();
}
