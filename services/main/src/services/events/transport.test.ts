import {
	AckPolicy,
	DiscardPolicy,
	RetentionPolicy,
	StorageType,
	type JetStreamClient,
	type JsMsg,
} from "@nats-io/jetstream";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { acknowledgeOutcome, processDelivery, retryDelayMs, type EventHandler } from "./consumer";
import {
	aggregateRoutingBucket,
	decodeEnvelope,
	encodeEnvelope,
	envelopeSubject,
	MAX_ENVELOPE_BYTES,
	type EventEnvelope,
} from "./envelope";
import { publishEnvelope } from "./publisher";
import { consumerConfig, DELIVERY_LIMITS, streamConfig, type StreamRoute } from "./topology";

const envelope: EventEnvelope = {
	version: 1,
	messageId: "f74257ae-c832-49b5-b4d2-480e57249129",
	class: "task",
	kind: "catalog.apply",
	occurredAt: "2026-09-07T00:00:00Z",
	correlationId: null,
	causationId: null,
	routingEpoch: 1,
	routingBucket: aggregateRoutingBucket("catalog", "some-owner-id"),
	aggregate: { owner: "catalog", key: "some-owner-id", revision: "9007199254740993" },
	payload: { operationId: "op-1" },
};
const route: StreamRoute = {
	class: "task",
	epoch: 1,
	bucket: envelope.routingBucket,
	maxBytes: 1024 * 1024,
	maxMessages: 100,
	maxConsumers: 4,
	deployment: "qualification",
};
const signal = new AbortController().signal;

function message(data = encodeEnvelope(envelope)): JsMsg {
	return {
		data,
		subject: envelopeSubject(envelope),
		sid: 1,
		seq: 1,
		redelivered: false,
		headers: undefined,
		time: new Date(),
		timestamp: new Date().toISOString(),
		timestampNanos: BigInt(Date.now()) * 1_000_000n,
		info: {
			domain: "",
			stream: streamConfig(route).name,
			consumer: "apply",
			deliveryCount: 1,
			streamSequence: 1,
			deliverySequence: 1,
			timestampNanos: Date.now() * 1e6,
			pending: 0,
			redelivered: false,
		},
		ack: vi.fn(),
		nak: vi.fn(),
		term: vi.fn(),
		working: vi.fn(),
		next: vi.fn(),
		ackAck: vi.fn(async () => true),
		json: () => {
			throw new Error("Do not trust unvalidated JSON");
		},
		string: () => "",
	};
}

function handler(): EventHandler<{ operationId: string }> {
	return {
		route,
		durable: "apply",
		kind: envelope.kind,
		parsePayload: (value) => z.strictObject({ operationId: z.string().min(1) }).parse(value),
		apply: vi.fn<EventHandler<{ operationId: string }>["apply"]>(async () => ({
			status: "committed",
			receiptId: "receipt-1",
		})),
		dispose: vi.fn<EventHandler<{ operationId: string }>["dispose"]>(async () => ({
			status: "terminal",
			receiptId: "failure-1",
		})),
	};
}

describe("event transport boundary", () => {
	it("round trips IDs and large decimal revisions without inventing authority", () => {
		expect(decodeEnvelope(encodeEnvelope(envelope))).toEqual(envelope);
		expect(envelopeSubject(envelope)).toBe(
			`rezics.tasks.e1.b${envelope.routingBucket}.catalog.apply`,
		);
	});
	it.each([
		{ ...envelope, version: 0 },
		{ ...envelope, kind: "catalog.*" },
		{ ...envelope, routingBucket: 1024 },
		{ ...envelope, extra: true },
		{ ...envelope, payload: ["not-an-object"] },
		{ ...envelope, messageId: "not-a-uuid" },
	])("rejects invalid envelope %j", (value) => {
		expect(() => encodeEnvelope(value)).toThrow();
	});
	it("bounds encoded UTF-8 bytes and rejects malformed UTF-8", () => {
		expect(() =>
			encodeEnvelope({ ...envelope, payload: { text: "字".repeat(MAX_ENVELOPE_BYTES / 2) } }),
		).toThrow();
		expect(() => decodeEnvelope(new Uint8Array(MAX_ENVELOPE_BYTES + 1))).toThrow();
		expect(() => decodeEnvelope(new Uint8Array([0xff]))).toThrow();
	});
	it("uses separate bounded retention policies with no task expiry", () => {
		expect(streamConfig(route)).toMatchObject({
			retention: RetentionPolicy.Workqueue,
			storage: StorageType.File,
			discard: DiscardPolicy.New,
			max_age: 0,
			num_replicas: 1,
		});
		expect(streamConfig({ ...route, class: "event", deployment: "production" })).toMatchObject({
			retention: RetentionPolicy.Limits,
			max_age: 259_200 * 1e9,
			num_replicas: 3,
		});
		expect(consumerConfig(route, "apply", envelope.kind)).toMatchObject({
			ack_policy: AckPolicy.Explicit,
			max_deliver: 10,
			max_ack_pending: 64,
			max_batch: 32,
			max_bytes: 2 * 1024 * 1024,
		});
	});
	it("requires commit resolution before ACK", async () => {
		const msg = message();
		const owner = handler();
		const commit = Promise.withResolvers<{ status: "committed"; receiptId: string }>();
		owner.apply = () => commit.promise;
		const pending = processDelivery(msg, owner, signal);
		await Promise.resolve();
		expect(msg.ackAck).not.toHaveBeenCalled();
		commit.resolve({ status: "committed", receiptId: "receipt" });
		await pending;
		expect(msg.ackAck).toHaveBeenCalledOnce();
	});
	it("leaves lease-lost deliveries untouched", async () => {
		const msg = message();
		const owner = handler();
		owner.apply = async () => ({ status: "lease_lost" });
		await processDelivery(msg, owner, signal);
		expect(msg.ackAck).not.toHaveBeenCalled();
		expect(msg.nak).not.toHaveBeenCalled();
		expect(msg.term).not.toHaveBeenCalled();
	});
	it("ACKs durable duplicates without making an exactly-once transport claim", async () => {
		const msg = message();
		await acknowledgeOutcome(msg, { status: "duplicate", receiptId: "receipt" });
		expect(msg.ackAck).toHaveBeenCalledOnce();
	});
	it("validates the kind payload before application", async () => {
		const msg = message(encodeEnvelope({ ...envelope, payload: { arbitrary: true } }));
		const owner = handler();
		await processDelivery(msg, owner, signal);
		expect(owner.apply).not.toHaveBeenCalled();
		expect(owner.dispose).toHaveBeenCalledOnce();
		expect(msg.ackAck).toHaveBeenCalledOnce();
	});
	it("persists quarantine before ACK for mismatched subjects", async () => {
		const msg = message();
		msg.subject = "rezics.tasks.e1.b1.catalog.apply";
		const owner = handler();
		owner.dispose = async () => {
			expect(msg.ackAck).not.toHaveBeenCalled();
			return { status: "terminal", receiptId: "failure" };
		};
		await processDelivery(msg, owner, signal);
		expect(owner.apply).not.toHaveBeenCalled();
		expect(msg.ackAck).toHaveBeenCalledOnce();
	});
	it("keeps poison work pending when durable quarantine fails", async () => {
		const msg = message(new TextEncoder().encode("invalid"));
		const owner = handler();
		owner.dispose = vi.fn(async () => {
			throw new Error("database unavailable");
		});
		await expect(processDelivery(msg, owner, signal)).rejects.toThrow("database unavailable");
		expect(owner.dispose).toHaveBeenCalledWith(
			expect.objectContaining({
				envelope: null,
				delivery: expect.objectContaining({
					sequence: 1,
					payloadSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
				}),
			}),
			signal,
		);
		expect(msg.ackAck).not.toHaveBeenCalled();
		expect(msg.term).not.toHaveBeenCalled();
	});
	it("delays retry only before the final delivery", async () => {
		const msg = message();
		const owner = handler();
		owner.apply = async () => {
			throw new Error("retry");
		};
		await processDelivery(msg, owner, signal);
		expect(msg.nak).toHaveBeenCalledOnce();
		expect(owner.dispose).not.toHaveBeenCalled();
		msg.info.deliveryCount = DELIVERY_LIMITS.maxAttempts;
		await processDelivery(msg, owner, signal);
		expect(owner.dispose).toHaveBeenCalledOnce();
		expect(msg.ackAck).toHaveBeenCalledOnce();
		expect(msg.nak).toHaveBeenCalledTimes(1);
	});
	it("surfaces lost ACK without disposing already committed work", async () => {
		const msg = message();
		const owner = handler();
		msg.ackAck = async () => false;
		await expect(processDelivery(msg, owner, signal)).rejects.toThrow("confirm");
		expect(owner.dispose).not.toHaveBeenCalled();
		expect(msg.nak).not.toHaveBeenCalled();
	});
	it("bounds delay and jitter", () => {
		expect(retryDelayMs(1, 0)).toBe(500);
		expect(retryDelayMs(10, 0.99)).toBeLessThanOrEqual(60_000);
		expect(() => retryDelayMs(0)).toThrow();
		expect(() => retryDelayMs(1, 1)).toThrow();
	});
	it("accepts replayable events older than one day", async () => {
		const msg = message();
		msg.time = new Date(Date.now() - 30 * 60 * 60 * 1000);
		const owner = handler();
		await processDelivery(msg, owner, signal);
		expect(owner.apply).toHaveBeenCalledOnce();
		expect(owner.dispose).not.toHaveBeenCalled();
	});
	it("routes explicit retry at MaxDeliver through durable disposition", async () => {
		const msg = message();
		msg.info.deliveryCount = 10;
		const owner = handler();
		owner.apply = async () => ({ status: "retry", delayMs: 900_000 });
		await processDelivery(msg, owner, signal);
		expect(owner.dispose).toHaveBeenCalledOnce();
		expect(msg.nak).not.toHaveBeenCalled();
		expect(msg.ackAck).toHaveBeenCalledOnce();
	});
	it("alarms when the failure owner cannot terminally resolve an exhausted delivery", async () => {
		const msg = message();
		msg.info.deliveryCount = 10;
		const owner = handler();
		owner.apply = async () => {
			throw new Error("attempt failed");
		};
		owner.dispose = async () => ({ status: "retry", delayMs: 500 });
		await expect(processDelivery(msg, owner, signal)).rejects.toThrow("exhausted");
		expect(msg.nak).not.toHaveBeenCalled();
		expect(msg.ackAck).not.toHaveBeenCalled();
	});
	it("rejects a second receipt namespace for the same aggregate", () => {
		expect(() =>
			encodeEnvelope({ ...envelope, routingBucket: (envelope.routingBucket + 1) % 1024 }),
		).toThrow("Routing bucket");
		expect(aggregateRoutingBucket("catalog", "some-owner-id")).toBe(envelope.routingBucket);
	});
	it("awaits publish ACK and rejects configured-route mismatch", async () => {
		const completion = Promise.withResolvers<{ stream: string; seq: number; duplicate: boolean }>();
		const publish = vi.fn(() => completion.promise);
		// This adapter only uses publish; retain the official method's complete signature.
		const client: Pick<JetStreamClient, "publish"> = { publish };
		const pending = publishEnvelope(client, route, envelope);
		expect(publish).toHaveBeenCalledWith(
			envelopeSubject(envelope),
			expect.any(Uint8Array),
			expect.objectContaining({
				msgID: envelope.messageId,
				expect: { streamName: streamConfig(route).name },
			}),
		);
		completion.resolve({ stream: streamConfig(route).name, seq: 1, duplicate: false });
		expect((await pending).seq).toBe(1);
		await expect(publishEnvelope(client, route, { ...envelope, routingEpoch: 2 })).rejects.toThrow(
			"configured",
		);
	});
});
