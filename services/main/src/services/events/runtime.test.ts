import { describe, expect, it } from "vitest";
import { parseEventWorkerConfig } from "./config";
import { quarantineIdentity } from "./failure";
import { EventWorkerHealth, runEventLane } from "./runtime";
const env = {
	NATS_URL: "nats://127.0.0.1:44222",
	EVENT_WORKER_BUCKETS: "1,2",
	EVENT_WORKER_STREAM_BYTES: "1048576",
	EVENT_WORKER_STREAM_MESSAGES: "1000",
};
describe("event worker runtime", () => {
	it("requires explicit finite assignment and capacity", () => {
		expect(parseEventWorkerConfig(env).EVENT_WORKER_BUCKETS).toEqual([1, 2]);
		for (const patch of [
			{ EVENT_WORKER_BUCKETS: "1,1" },
			{ EVENT_WORKER_BUCKETS: "" },
			{ EVENT_WORKER_BUCKETS: "1," },
			{ EVENT_WORKER_BUCKETS: "1024" },
			{ EVENT_WORKER_STREAM_BYTES: "0" },
			{ EVENT_WORKER_DEPLOYMENT: "production" },
			{ NATS_URL: "https://example.com" },
		])
			expect(() => parseEventWorkerConfig({ ...env, ...patch })).toThrow();
	});
	it("does not report readiness until every configured lane is registered", () => {
		const health = new EventWorkerHealth();
		health.register("one");
		health.success("one");
		expect(health.snapshot().ready).toBe(false);
		health.start();
		expect(health.snapshot().ready).toBe(true);
		health.register("two");
		expect(health.snapshot().ready).toBe(false);
	});
	it("quarantine identity is stable and independent of hostile envelope identifiers", () => {
		const route = {
			class: "task" as const,
			epoch: 1,
			bucket: 1,
			maxBytes: 1048576,
			maxMessages: 1000,
			maxConsumers: 4,
			deployment: "qualification" as const,
		};
		const failure = {
			delivery: {
				stream: "stream",
				consumer: "worker",
				sequence: 12,
				deliveryCount: 1,
				payloadSha256: "a".repeat(64),
			},
			envelope: null,
			reason: "invalid_message" as const,
			detail: "invalid",
		};
		expect(quarantineIdentity(route, failure)).toEqual(
			quarantineIdentity(route, {
				...failure,
				delivery: { ...failure.delivery, deliveryCount: 999 },
			}),
		);
		expect(quarantineIdentity(route, failure).operationId).not.toBe(
			quarantineIdentity(route, { ...failure, delivery: { ...failure.delivery, sequence: 13 } })
				.operationId,
		);
	});
	it("marks startup unhealthy and makes shutdown interrupt failure backoff", async () => {
		const health = new EventWorkerHealth();
		const signal = new AbortController();
		let calls = 0;
		expect(health.snapshot().ready).toBe(false);
		const run = runEventLane(
			"test",
			async () => {
				calls++;
				signal.abort();
				throw new Error("unavailable");
			},
			health,
			signal.signal,
		);
		await run;
		expect(calls).toBe(1);
		expect(health.snapshot().ready).toBe(false);
	});
});
