import { z } from "zod";
import {
	aggregateRoutingBucket,
	decodeEnvelope,
	encodeEnvelope,
	eventEnvelopeSchema,
} from "../events/envelope";

const sha256 = z.string().regex(/^[a-f0-9]{64}$/u);

/** Exact immutable observation reference; the owning reader must verify persisted evidence. @internal */
export const SourceObservationPayloadSchema = z.strictObject({
	sourceRecordId: z.uuid(),
	snapshotId: z.uuid(),
	contentSha256: sha256,
	contractSha256: sha256,
});

const snapshotSchema = z.object({
	sourceRecordId: z.uuid(),
	id: z.uuid(),
	contentSha256: sha256,
	contractSha256: sha256,
	observedAt: z.date(),
});

/** An observation is recorded; this event makes no claim of upstream recency or canonical adoption. @internal */
export function createSourceObservationEvent(input: z.input<typeof snapshotSchema>) {
	const snapshot = snapshotSchema.parse(input);
	return eventEnvelopeSchema.parse({
		version: 1,
		messageId: snapshot.id,
		class: "event",
		kind: "source.record.observed",
		occurredAt: snapshot.observedAt.toISOString(),
		correlationId: null,
		causationId: null,
		routingEpoch: 1,
		routingBucket: aggregateRoutingBucket("source_record", snapshot.sourceRecordId),
		aggregate: { owner: "source_record", key: snapshot.sourceRecordId, revision: null },
		payload: {
			sourceRecordId: snapshot.sourceRecordId,
			snapshotId: snapshot.id,
			contentSha256: snapshot.contentSha256,
			contractSha256: snapshot.contractSha256,
		},
	});
}

/** Re-establish the observation contract after transport; no database existence or authority is inferred. @internal */
export function parseSourceObservationEvent(input: unknown) {
	const envelope = decodeEnvelope(encodeEnvelope(input));
	const payload = SourceObservationPayloadSchema.parse(envelope.payload);
	if (
		envelope.class !== "event" ||
		envelope.kind !== "source.record.observed" ||
		envelope.aggregate.owner !== "source_record" ||
		envelope.aggregate.key !== payload.sourceRecordId ||
		envelope.aggregate.revision !== null ||
		envelope.messageId !== payload.snapshotId
	)
		throw new TypeError("Source observation envelope does not match its exact snapshot reference");
	return { envelope, payload };
}
