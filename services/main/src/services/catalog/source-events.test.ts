import { describe, expect, it } from "vitest";
import { aggregateRoutingBucket } from "../events/envelope";
import { createSourceObservationEvent, parseSourceObservationEvent } from "./source-events";

const recordId = "01992600-0000-7000-8000-000000000001";
const snapshotId = "01992600-0000-7000-8000-000000000002";
const otherId = "01992600-0000-7000-8000-000000000003";
const snapshot = {
	sourceRecordId: recordId,
	id: snapshotId,
	contentSha256: "a".repeat(64),
	contractSha256: "b".repeat(64),
	observedAt: new Date("2026-09-07T00:00:00.000Z"),
};

describe("source observation events", () => {
	it("uses stable snapshot identity and exact evidence without raw source payloads", () => {
		const event = createSourceObservationEvent(snapshot);
		expect(parseSourceObservationEvent(JSON.parse(JSON.stringify(event))).payload).toEqual({
			sourceRecordId: recordId,
			snapshotId,
			contentSha256: snapshot.contentSha256,
			contractSha256: snapshot.contractSha256,
		});
		expect(createSourceObservationEvent({ ...snapshot })).toEqual(event);
	});
	it("rejects a different snapshot, source record or event meaning", () => {
		const event = createSourceObservationEvent(snapshot);
		for (const changed of [
			{ ...event, messageId: otherId },
			{ ...event, payload: { ...event.payload, sourceRecordId: otherId } },
			{ ...event, kind: "catalog.identity.changed" },
			{ ...event, class: "task" },
			{ ...event, aggregate: { ...event.aggregate, revision: "1" } },
		])
			expect(() => parseSourceObservationEvent(changed)).toThrow();
	});
	it("rejects a self-consistent transport route that names another aggregate owner", () => {
		const event = createSourceObservationEvent(snapshot);
		expect(() =>
			parseSourceObservationEvent({
				...event,
				aggregate: { ...event.aggregate, owner: "software" },
				routingBucket: aggregateRoutingBucket("software", recordId),
			}),
		).toThrow("exact snapshot reference");
	});
	it("rejects incomplete evidence and unrequested payload fields", () => {
		expect(() =>
			createSourceObservationEvent({ ...snapshot, contentSha256: "not-a-hash" }),
		).toThrow();
		const event = createSourceObservationEvent(snapshot);
		expect(() =>
			parseSourceObservationEvent({ ...event, payload: { ...event.payload, raw: {} } }),
		).toThrow();
	});
});
