import { randomUUID } from "node:crypto";
import { describe, expect, test } from "vitest";
import { aggregateRoutingBucket } from "./envelope";
import { parseTaskRequest } from "./durability";

const aggregate = { owner: "test", key: "key", revision: "1" };
function task() {
	return {
		version: 1,
		messageId: randomUUID(),
		class: "task",
		kind: "test.execute",
		occurredAt: new Date().toISOString(),
		causationId: null,
		correlationId: null,
		routingEpoch: 1,
		routingBucket: aggregateRoutingBucket(aggregate.owner, aggregate.key),
		aggregate,
		payload: {
			operationId: randomUUID(),
			consumerKey: "test.g1",
			maximumAttempts: 3,
			deadline: "2026-09-08T00:00:00.000Z",
			value: 1,
		},
	};
}
describe("durable task semantic request", () => {
	test("republishing changes transport identity while preserving semantic fingerprint", () => {
		const original = task();
		const first = parseTaskRequest(original);
		expect(
			parseTaskRequest({
				...original,
				messageId: randomUUID(),
				routingEpoch: 2,
				occurredAt: "2026-09-07T12:00:00.000Z",
			}).identity,
		).toEqual(first.identity);
	});
	test("payload/revision/consumer changes cannot reuse the original fingerprint", () => {
		const original = task();
		const first = parseTaskRequest(original).identity.requestFingerprint;
		for (const changed of [
			{ ...original, payload: { ...original.payload, value: 2 } },
			{ ...original, aggregate: { ...aggregate, revision: "2" } },
			{ ...original, payload: { ...original.payload, consumerKey: "test.g2" } },
		])
			expect(parseTaskRequest(changed).identity.requestFingerprint).not.toBe(first);
	});
	test("canonical object order, finite attempts, required task fields and payload limits", () => {
		const original = task();
		expect(
			parseTaskRequest({
				...original,
				payload: Object.fromEntries(Object.entries(original.payload).reverse()),
			}).identity,
		).toEqual(parseTaskRequest(original).identity);
		for (const payload of [
			{},
			{ ...original.payload, maximumAttempts: 0 },
			{ ...original.payload, maximumAttempts: 33 },
			{ ...original.payload, value: "x".repeat(65536) },
		])
			expect(() => parseTaskRequest({ ...original, payload })).toThrow();
	});
});
