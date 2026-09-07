import { createHash } from "node:crypto";
import { z } from "zod";

export const MAX_ENVELOPE_BYTES = 64 * 1024;
const token = z
	.string()
	.regex(/^[a-z][a-z0-9_-]*$/)
	.max(64);
export const eventKindSchema = z
	.string()
	.regex(/^[a-z][a-z0-9_-]*(\.[a-z][a-z0-9_-]*)*$/)
	.max(128);

/** Stable epoch-independent bucket; owner cannot contain the ':' separator. @internal */
export function aggregateRoutingBucket(owner: string, key: string): number {
	token.parse(owner);
	z.string().min(1).max(256).parse(key);
	return createHash("sha256").update(`${owner}:${key}`, "utf8").digest().readUInt16BE(0) % 1024;
}

/** Transport shape only; owner references, revisions and payloads remain untrusted. @internal */
export const eventEnvelopeSchema = z
	.strictObject({
		version: z.literal(1),
		messageId: z.uuid(),
		class: z.enum(["event", "task"]),
		kind: eventKindSchema,
		occurredAt: z.iso.datetime({ offset: true }),
		correlationId: z.uuid().nullable(),
		causationId: z.uuid().nullable(),
		routingEpoch: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
		routingBucket: z.number().int().min(0).max(1023),
		aggregate: z.strictObject({
			owner: token,
			key: z.string().min(1).max(256),
			revision: z
				.string()
				.regex(/^(0|[1-9][0-9]*)$/)
				.max(20)
				.nullable(),
		}),
		payload: z.record(z.string(), z.json()),
	})
	.refine(
		(value) =>
			value.routingBucket === aggregateRoutingBucket(value.aggregate.owner, value.aggregate.key),
		{
			message: "Routing bucket does not match aggregate identity",
			path: ["routingBucket"],
		},
	);

/** @internal */
export type EventEnvelope = z.infer<typeof eventEnvelopeSchema>;

/** @internal */
export function encodeEnvelope(input: unknown): Uint8Array {
	const data = new TextEncoder().encode(JSON.stringify(eventEnvelopeSchema.parse(input)));
	if (data.byteLength > MAX_ENVELOPE_BYTES) throw new Error("Event envelope exceeds 64 KiB");
	return data;
}

/** @internal */
export function decodeEnvelope(data: Uint8Array): EventEnvelope {
	if (data.byteLength > MAX_ENVELOPE_BYTES) throw new Error("Event envelope exceeds 64 KiB");
	const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(data));
	return eventEnvelopeSchema.parse(value);
}

/** Routing is a delivery hint, never an authorization or ordering guarantee. @internal */
export function envelopeSubject(envelope: EventEnvelope): string {
	return `rezics.${envelope.class === "event" ? "events" : "tasks"}.e${envelope.routingEpoch}.b${envelope.routingBucket}.${envelope.kind}`;
}
