import type { JetStreamClient, PubAck } from "@nats-io/jetstream";
import { decodeEnvelope, encodeEnvelope, envelopeSubject } from "./envelope";
import { streamConfig, type StreamRoute } from "./topology";

/** Publish only committed outbox data. Resolution proves broker ACK, not database progress. @internal */
export async function publishEnvelope(
	client: Pick<JetStreamClient, "publish">,
	route: StreamRoute,
	value: unknown,
): Promise<PubAck> {
	const bytes = encodeEnvelope(value);
	const envelope = decodeEnvelope(bytes);
	if (
		envelope.class !== route.class ||
		envelope.routingEpoch !== route.epoch ||
		envelope.routingBucket !== route.bucket
	) {
		throw new Error("Envelope does not belong to configured stream route");
	}
	const expectedStream = streamConfig(route).name;
	const ack = await client.publish(envelopeSubject(envelope), bytes, {
		msgID: envelope.messageId,
		expect: { streamName: expectedStream },
		timeout: 5_000,
		retries: 1,
	});
	if (ack.stream !== expectedStream || !Number.isSafeInteger(ack.seq) || ack.seq < 1) {
		throw new Error("Invalid JetStream publication acknowledgment");
	}
	return ack;
}
