import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createConnection, createServer, type Socket } from "node:net";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { jetstream, jetstreamManager } from "@nats-io/jetstream";
import { connect } from "@nats-io/transport-node";
import pg from "pg";
import { z } from "zod";
import {
	aggregateRoutingBucket,
	decodeEnvelope,
	encodeEnvelope,
	envelopeSubject,
	type EventEnvelope,
} from "../src/services/events/envelope";
import { streamConfig, type StreamRoute } from "../src/services/events/topology";
import { publishEnvelope } from "../src/services/events/publisher";

// This command owns only fresh, uniquely named fixtures. It never accepts an existing database.
assert.equal(process.env.REZICS_DISPOSABLE_EVENT_FIXTURE, "1");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const tempRoot = resolve(root, ".temp/runtime-debezium");
const runId = `relay-${randomUUID().slice(0, 8)}`;
const temp = resolve(tempRoot, runId);
const network = `rezics-${runId}`;
const postgresName = `${network}-postgres`;
const natsName = `${network}-nats`;
const relayName = `${network}-debezium`;
const images = {
	postgres:
		"postgres:18-alpine@sha256:d3e1620b530c944afa6e887d22eb899824da68e19c52024bf98f5220c88a65b2",
	nats: "nats:2.14.6@sha256:d4a8980c1ee558257f196f86693ec919c7a8b8095dd678e2cb5ff1adcfe03ecb",
	debezium:
		"quay.io/debezium/server:3.6.2.Final@sha256:190ad95cf6820dc3ee2fd8bb58d11d96bc32f98bc75a1ddf804d4339f7926a79",
};
const exec = promisify(execFile);
const docker = async (...args: string[]) => {
	const result = await exec("docker", args, { maxBuffer: 4 * 1024 * 1024 });
	return result.stdout.trim();
};
const delay = (ms: number) => new Promise<void>((done) => setTimeout(done, ms));
async function eventually(check: () => Promise<boolean>, description: string, timeout = 60_000) {
	const end = Date.now() + timeout;
	let nextHealthCheck = 0;
	while (Date.now() < end) {
		if (await check()) return;
		if (containers.includes(relayName) && Date.now() >= nextHealthCheck) {
			assert.equal(
				await docker("inspect", relayName, "--format", "{{.State.Running}}"),
				"true",
				"Debezium exited before the expected result",
			);
			nextHealthCheck = Date.now() + 2_000;
		}
		await delay(200);
	}
	throw new Error(`Timed out: ${description}`);
}
const containers: string[] = [];
const launch = async (name: string, args: string[]) => {
	await docker("create", "--name", name, ...args);
	containers.push(name);
	await docker("start", name);
};
let networkCreated = false;
const sockets = new Set<Socket>();
let loseNextAck = false;
let droppedAcks = 0;
let duplicateAcks = 0;
const ackSchema = z.object({
	stream: z.string(),
	seq: z.number().int().positive(),
	duplicate: z.boolean().optional(),
});
const observedAcks: z.infer<typeof ackSchema>[] = [];
// Parse complete server frames; dropping a TCP chunk could accidentally discard unrelated traffic.
const proxy = createServer((downstream) => {
	const upstream = createConnection({ host: "127.0.0.1", port: 44222 });
	sockets.add(downstream);
	sockets.add(upstream);
	let buffered: Buffer = Buffer.alloc(0);
	downstream.pipe(upstream);
	upstream.on("data", (chunk: Buffer) => {
		buffered = Buffer.concat([buffered, chunk]);
		assert.ok(buffered.length < 128 * 1024, "Proxy frame buffer must remain bounded");
		while (true) {
			const lineEnd = buffered.indexOf("\r\n");
			if (lineEnd < 0) return;
			const line = buffered.subarray(0, lineEnd).toString("utf8");
			const fields = line.split(" ");
			const hasBody = fields[0] === "MSG" || fields[0] === "HMSG";
			const bodySize = hasBody ? Number(fields.at(-1)) : 0;
			assert.ok(Number.isSafeInteger(bodySize) && bodySize >= 0 && bodySize <= 65_536);
			const frameSize = lineEnd + 2 + (hasBody ? bodySize + 2 : 0);
			if (buffered.length < frameSize) return;
			const frame = buffered.subarray(0, frameSize);
			buffered = buffered.subarray(frameSize);
			const body = frame.subarray(lineEnd + 2, lineEnd + 2 + bodySize).toString("utf8");
			const parsedAck = ackSchema.safeParse(
				hasBody && body.startsWith("{") ? JSON.parse(body) : null,
			);
			if (parsedAck.success && observedAcks.length < 16) observedAcks.push(parsedAck.data);
			if (parsedAck.success && parsedAck.data.duplicate) duplicateAcks++;
			if (parsedAck.success && loseNextAck) {
				loseNextAck = false;
				droppedAcks++;
				continue;
			}
			downstream.write(frame);
		}
	});
	for (const [socket, other] of [
		[downstream, upstream],
		[upstream, downstream],
	] as const) {
		socket.on("error", () => other.destroy());
		socket.on("close", () => {
			sockets.delete(socket);
			other.destroy();
		});
	}
});
let connection: Awaited<ReturnType<typeof connect>> | undefined;
let database: pg.Client | undefined;
const aggregate = { owner: "relay-fixture", key: runId, revision: "1" };
const route: StreamRoute = {
	class: "event",
	epoch: 1,
	bucket: aggregateRoutingBucket(aggregate.owner, aggregate.key),
	maxBytes: 1024 * 1024,
	maxMessages: 100,
	maxConsumers: 4,
	deployment: "qualification",
};
const envelope = (): EventEnvelope => ({
	version: 1,
	messageId: randomUUID(),
	class: "event",
	kind: "relay.check",
	occurredAt: new Date().toISOString(),
	correlationId: null,
	causationId: null,
	routingEpoch: route.epoch,
	routingBucket: route.bucket,
	aggregate,
	payload: { fixture: true, nested: { nullable: null, text: "实体专辑 / édition / 🎼" } },
});
const insert = async (event: EventEnvelope) => {
	assert.ok(database);
	await database.query(
		`insert into operational_outbox
		(routing_bucket,message_id,message_class,kind,routing_epoch,subject,aggregate_key,occurred_at,payload,serialized_envelope)
		values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)`,
		[
			event.routingBucket,
			event.messageId,
			event.class,
			event.kind,
			event.routingEpoch,
			envelopeSubject(event),
			event.aggregate.key,
			event.occurredAt,
			JSON.stringify(event),
			JSON.stringify(event),
		],
	);
};
const startRelay = async () => {
	await launch(relayName, [
		"--network",
		network,
		"--memory",
		"1g",
		"--cpus",
		"2",
		"-p",
		"127.0.0.1:48080:8080",
		"-v",
		`${resolve(temp, "config/application.properties")}:/debezium/config/application.properties:ro`,
		"-v",
		`${resolve(temp, "data")}:/debezium/data`,
		images.debezium,
	]);
};
try {
	await mkdir(resolve(temp, "config"), { recursive: true });
	await mkdir(resolve(temp, "data"));
	const imageDigests: Record<string, string> = {};
	for (const [name, image] of Object.entries(images)) {
		imageDigests[name] = await docker(
			"image",
			"inspect",
			image,
			"--format",
			'{{join .RepoDigests ","}}',
		);
	}
	await writeFile(
		resolve(temp, "nats.conf"),
		"port: 4222\njetstream { store_dir: /data, max_memory_store: 16MB, max_file_store: 64MB, sync_interval: always }\n",
	);
	await writeFile(
		resolve(temp, "config/application.properties"),
		[
			"debezium.sink.type=nats-jetstream",
			"debezium.sink.nats-jetstream.url=nats://host.docker.internal:44223",
			"debezium.sink.nats-jetstream.create-stream=false",
			"debezium.sink.nats-jetstream.async.enabled=false",
			"debezium.source.connector.class=io.debezium.connector.postgresql.PostgresConnector",
			"debezium.source.database.hostname=postgres",
			"debezium.source.database.port=5432",
			"debezium.source.database.user=fixture",
			"debezium.source.database.password=disposable-fixture-only",
			"debezium.source.database.dbname=fixture",
			"debezium.source.plugin.name=pgoutput",
			"debezium.source.slot.name=rezics_qualification",
			"debezium.source.publication.name=rezics_qualification",
			"debezium.source.publication.autocreate.mode=disabled",
			"debezium.source.topic.prefix=qualification",
			"debezium.source.table.include.list=public.operational_outbox",
			"debezium.source.snapshot.mode=initial",
			"debezium.source.offset.storage=org.apache.kafka.connect.storage.FileOffsetBackingStore",
			"debezium.source.offset.storage.file.filename=/debezium/data/offsets.dat",
			"debezium.source.offset.flush.interval.ms=0",
			"debezium.source.max.batch.size=16",
			"debezium.source.max.queue.size=32",
			"debezium.source.max.queue.size.in.bytes=2097152",
			"debezium.source.poll.interval.ms=100",
			"debezium.format.value=simplestring",
			"debezium.format.key=simplestring",
			"debezium.format.header=json",
			"debezium.format.header.class=org.apache.kafka.connect.storage.SimpleHeaderConverter",
			"debezium.transforms=outbox",
			"debezium.transforms.outbox.type=io.debezium.transforms.outbox.EventRouter",
			"debezium.transforms.outbox.table.field.event.id=message_id",
			"debezium.transforms.outbox.table.field.event.key=aggregate_key",
			"debezium.transforms.outbox.table.field.event.payload=serialized_envelope",
			"debezium.transforms.outbox.table.fields.additional.placement=message_id:header:Nats-Msg-Id",
			"debezium.transforms.outbox.route.by.field=subject",
			"debezium.transforms.outbox.route.topic.replacement=$${routedByValue}",
		].join("\n"),
	);
	await docker("network", "create", network);
	networkCreated = true;
	await launch(postgresName, [
		"--network",
		network,
		"--network-alias",
		"postgres",
		"--memory",
		"512m",
		"--cpus",
		"1",
		"-p",
		"127.0.0.1:25432:5432",
		"-e",
		"POSTGRES_USER=fixture",
		"-e",
		"POSTGRES_PASSWORD=disposable-fixture-only",
		"-e",
		"POSTGRES_DB=fixture",
		images.postgres,
		"-c",
		"wal_level=logical",
		"-c",
		"max_slot_wal_keep_size=128MB",
	]);
	await launch(natsName, [
		"--network",
		network,
		"--memory",
		"128m",
		"--cpus",
		"1",
		"-p",
		"127.0.0.1:44222:4222",
		"-v",
		`${resolve(temp, "nats.conf")}:/etc/nats.conf:ro`,
		images.nats,
		"-c",
		"/etc/nats.conf",
	]);
	await eventually(async () => {
		try {
			await docker("exec", postgresName, "pg_isready", "-h", "127.0.0.1", "-U", "fixture");
			return true;
		} catch {
			return false;
		}
	}, "PostgreSQL readiness");
	database = new pg.Client({
		host: "127.0.0.1",
		port: 25432,
		user: "fixture",
		password: "disposable-fixture-only",
		database: "fixture",
	});
	await database.connect();
	// Deliberately a fixture projection, not the canonical migration/integrity acceptance.
	await database.query(`create table operational_outbox (
		routing_bucket integer not null, message_id uuid not null, message_class text not null,
		kind text not null, routing_epoch bigint not null, subject text not null,
		aggregate_key text not null, occurred_at timestamptz not null, payload jsonb not null,
		serialized_envelope text not null, created_at timestamptz not null default now(),
		primary key (routing_bucket, message_id)
	) partition by range (routing_bucket);
	create table operational_outbox_p0 partition of operational_outbox for values from (0) to (512);
	create table operational_outbox_p1 partition of operational_outbox for values from (512) to (1024);
	create publication rezics_qualification for table operational_outbox with (publish='insert',publish_via_partition_root=true);`);
	connection = await connect({ servers: "nats://127.0.0.1:44222", reconnect: false });
	const manager = await jetstreamManager(connection);
	const stream = streamConfig(route).name;
	await manager.streams.add(streamConfig(route));
	await new Promise<void>((done, reject) => {
		proxy.once("error", reject);
		proxy.listen(44223, "127.0.0.1", done);
	});
	const count = async () => (await manager.streams.info(stream)).state.messages;
	const verify = async (sequence: number, expected: EventEnvelope) => {
		const received = await manager.streams.getMessage(stream, { seq: sequence });
		assert.ok(received);
		assert.equal(received.subject, envelopeSubject(expected));
		assert.deepEqual(decodeEnvelope(received.data), expected);
		assert.deepEqual(received.data, encodeEnvelope(expected));
		assert.equal(received.header.get("Nats-Msg-Id"), expected.messageId);
	};
	const initial = envelope();
	await insert(initial);
	await startRelay();
	await eventually(async () => (await count()) === 1, "snapshot publication", 120_000);
	await verify(1, initial);
	assert.equal(
		(await publishEnvelope(jetstream(connection), route, initial)).duplicate,
		true,
		"Direct publisher and Debezium must share the same broker deduplication identity",
	);
	const committed = envelope();
	await insert(committed);
	await eventually(async () => (await count()) === 2, "partition-root WAL publication");
	await verify(2, committed);
	await database.query("begin");
	await insert(envelope());
	await database.query("rollback");
	await delay(500);
	assert.equal(await count(), 2, "Rolled-back rows must not reach the broker");
	const offsetFile = resolve(temp, "data/offsets.dat");
	await eventually(async () => {
		try {
			return (await stat(offsetFile)).size > 0;
		} catch {
			return false;
		}
	}, "durable offset file");
	await docker("stop", "--time", "15", relayName);
	const offsetBeforeRestart = await readFile(offsetFile);
	await docker("rm", relayName);
	const offline = envelope();
	await insert(offline);
	await startRelay();
	await eventually(async () => (await count()) === 3, "persisted-offset restart catch-up");
	await verify(3, offline);
	assert.ok(
		(await docker("logs", relayName)).includes("Found previous offset"),
		"Restart must load existing offsets",
	);
	await eventually(
		async () => !(await readFile(offsetFile)).equals(offsetBeforeRestart),
		"offset advancement after restart",
	);
	console.log(
		"PASS snapshot, exact bytes/subject, rollback exclusion, partition-root WAL, persisted-offset restart",
	);
	loseNextAck = true;
	const lostAckEvent = envelope();
	const offsetBeforeLostAck = await readFile(offsetFile);
	await insert(lostAckEvent);
	await eventually(async () => droppedAcks === 1, "proxy discarded a real JetStream publish ACK");
	await docker("kill", relayName);
	assert.equal(await count(), 4, "Broker persisted the event before its ACK was lost");
	assert.ok(
		(await readFile(offsetFile)).equals(offsetBeforeLostAck),
		"No connector progress past lost ACK",
	);
	await docker("rm", relayName);
	await startRelay();
	await eventually(async () => duplicateAcks > 0, "connector resends the unacknowledged stable ID");
	assert.equal(await count(), 4, "Broker deduplicates the replay within its configured window");
	await verify(4, lostAckEvent);
	const afterCrash = envelope();
	await insert(afterCrash);
	await eventually(async () => (await count()) === 5, "continued relay after lost-ACK restart");
	await verify(5, afterCrash);
	const slots = await database.query(
		"select slot_name, active, restart_lsn::text, confirmed_flush_lsn::text, pg_wal_lsn_diff(pg_current_wal_lsn(),restart_lsn)::text as retained_wal_bytes from pg_replication_slots where slot_name='rezics_qualification'",
	);
	const slot = z
		.array(
			z.object({
				slot_name: z.string(),
				active: z.boolean(),
				restart_lsn: z.string(),
				confirmed_flush_lsn: z.string(),
				retained_wal_bytes: z.string(),
			}),
		)
		.parse(slots.rows);
	console.log(
		JSON.stringify(
			{ result: "PASS", imageDigests, messages: await count(), droppedAcks, duplicateAcks, slot },
			null,
			2,
		),
	);
} catch (error) {
	console.error({ observedAcks, droppedAcks, duplicateAcks });
	if (containers.includes(relayName)) {
		console.error(await docker("logs", "--tail", "10", relayName).catch(String));
	}
	throw error;
} finally {
	await connection?.close();
	await database?.end();
	for (const socket of sockets) socket.destroy();
	if (proxy.listening) await new Promise<void>((done) => proxy.close(() => done()));
	for (const name of [...new Set(containers)].reverse()) await docker("rm", "-f", "-v", name);
	if (networkCreated) await docker("network", "rm", network);
	assert.equal(dirname(temp), tempRoot);
	await rm(temp, { recursive: true, force: true });
}
