import { createHash } from "node:crypto";
import type { Consumer, JsMsg } from "@nats-io/jetstream";
import { z } from "zod";
import { decodeEnvelope, envelopeSubject, type EventEnvelope } from "./envelope";
import { consumerConfig, DELIVERY_LIMITS, streamConfig, type StreamRoute } from "./topology";

const outcomeSchema = z.discriminatedUnion("status", [
	z.object({
		status: z.enum(["committed", "duplicate", "terminal"]),
		receiptId: z.string().min(1).max(256),
	}),
	z.strictObject({ status: z.literal("lease_lost") }),
	z.strictObject({ status: z.literal("retry"), delayMs: z.number().int().min(1).max(900_000) }),
]);

/** The callback must commit domain effects and its receipt in one transaction before returning. @internal */
export type DurableOutcome = z.infer<typeof outcomeSchema>;

/** Broker identity remains usable even when an envelope cannot be parsed. @internal */
export interface DeliveryIdentity {
	stream: string;
	consumer: string;
	sequence: number;
	deliveryCount: number;
	payloadSha256: string;
}

/** Persist a bounded failure record/replay disposition, not an unbounded copy of hostile input. @internal */
export interface DeliveryFailure {
	delivery: DeliveryIdentity;
	envelope: EventEnvelope | null;
	reason: "invalid_message" | "retry_exhausted";
	detail: string;
}

/** Parse payload by configured kind, then recheck current domain authority and fencing at commit. @internal */
export interface EventHandler<T> {
	route: StreamRoute;
	durable: string;
	kind: string;
	parsePayload(value: EventEnvelope["payload"]): T;
	apply(input: {
		envelope: EventEnvelope;
		payload: T;
		delivery: DeliveryIdentity;
		signal: AbortSignal;
	}): Promise<DurableOutcome>;
	dispose(failure: DeliveryFailure, signal: AbortSignal): Promise<DurableOutcome>;
}

async function disposeDelivery<T>(
	message: JsMsg,
	handler: EventHandler<T>,
	failure: DeliveryFailure,
	signal: AbortSignal,
): Promise<void> {
	const outcome = outcomeSchema.parse(await handler.dispose(failure, signal));
	if (outcome.status === "retry" && failure.delivery.deliveryCount >= DELIVERY_LIMITS.maxAttempts) {
		throw new Error("Terminal disposition cannot retry an exhausted delivery");
	}
	await acknowledgeOutcome(message, outcome);
}

/** No transport action follows lease loss: even a late ACK can remove a newer executor's task. @internal */
export async function acknowledgeOutcome(
	message: Pick<JsMsg, "ackAck" | "nak">,
	value: DurableOutcome,
): Promise<void> {
	const outcome = outcomeSchema.parse(value);
	if (outcome.status === "lease_lost") return;
	if (outcome.status === "retry") {
		message.nak(outcome.delayMs);
		return;
	}
	if (!(await message.ackAck({ timeout: 5_000 })))
		throw new Error("JetStream did not confirm receipt ACK");
}

/** @internal */
export function retryDelayMs(deliveryCount: number, random = Math.random()): number {
	if (
		!Number.isInteger(deliveryCount) ||
		deliveryCount < 1 ||
		!Number.isFinite(random) ||
		random < 0 ||
		random >= 1
	) {
		throw new Error("Invalid retry inputs");
	}
	return (
		Math.min(DELIVERY_LIMITS.maxRetryDelayMs, 1_000 * 2 ** Math.min(deliveryCount - 1, 6)) *
		(0.5 + random / 2)
	);
}

/** One delivery; persistence failures deliberately escape so the worker can stop and alarm. @internal */
export async function processDelivery<T>(
	message: JsMsg,
	handler: EventHandler<T>,
	signal: AbortSignal,
): Promise<void> {
	if (signal.aborted) return;
	const expected = consumerConfig(handler.route, handler.durable, handler.kind);
	const delivery: DeliveryIdentity = {
		stream: message.info.stream,
		consumer: message.info.consumer,
		sequence: message.info.streamSequence,
		deliveryCount: message.info.deliveryCount,
		payloadSha256: createHash("sha256").update(message.data).digest("hex"),
	};
	if (
		delivery.stream !== streamConfig(handler.route).name ||
		delivery.consumer !== handler.durable
	) {
		throw new Error("Delivery does not belong to configured consumer");
	}
	let envelope: EventEnvelope | null = null;
	let payload: T;
	try {
		envelope = decodeEnvelope(message.data);
		if (
			message.subject !== expected.filter_subject ||
			message.subject !== envelopeSubject(envelope)
		) {
			throw new Error("Envelope route does not match delivery subject");
		}
		payload = handler.parsePayload(envelope.payload);
	} catch {
		await disposeDelivery(
			message,
			handler,
			{
				delivery,
				envelope,
				reason: "invalid_message",
				detail: "Envelope, subject or kind payload validation failed",
			},
			signal,
		);
		return;
	}
	let outcome: DurableOutcome;
	try {
		outcome = outcomeSchema.parse(await handler.apply({ envelope, payload, delivery, signal }));
	} catch {
		if (signal.aborted) return;
		if (delivery.deliveryCount >= DELIVERY_LIMITS.maxAttempts) {
			await disposeDelivery(
				message,
				handler,
				{
					delivery,
					envelope,
					reason: "retry_exhausted",
					detail: "Application delivery attempts exhausted",
				},
				signal,
			);
		} else {
			message.nak(retryDelayMs(delivery.deliveryCount));
		}
		return;
	}
	// ACK failure must not rerun terminal handling after an already committed outcome.
	if (outcome.status === "retry" && delivery.deliveryCount >= DELIVERY_LIMITS.maxAttempts) {
		await disposeDelivery(
			message,
			handler,
			{
				delivery,
				envelope,
				reason: "retry_exhausted",
				detail: "Application delivery attempts exhausted",
			},
			signal,
		);
		return;
	}
	await acknowledgeOutcome(message, outcome);
}

/** Pull one finite batch and drain all started callbacks before returning. @internal */
export async function consumeBatch<T>(
	consumer: Consumer,
	handler: EventHandler<T>,
	signal: AbortSignal,
): Promise<number> {
	if (signal.aborted) return 0;
	const messages = await consumer.fetch({
		max_messages: DELIVERY_LIMITS.batch,
		// Client 3.4 forbids both pull limits; stream max_msg_size bounds these 32 payloads to 2 MiB.
		expires: DELIVERY_LIMITS.fetchMs,
	});
	const active = new Set<Promise<void>>();
	let failure: unknown;
	let failed = false;
	let count = 0;
	const stop = () => {
		void messages.close();
	};
	signal.addEventListener("abort", stop, { once: true });
	try {
		for await (const message of messages) {
			if (signal.aborted || failed) break;
			while (active.size >= DELIVERY_LIMITS.concurrency) await Promise.race(active);
			if (signal.aborted || failed) break;
			const deadline = new AbortController();
			const timeout = setTimeout(() => deadline.abort(), DELIVERY_LIMITS.handlerMs);
			const workSignal = AbortSignal.any([signal, deadline.signal]);
			const operation = processDelivery(message, handler, workSignal)
				.catch((error: unknown) => {
					failed = true;
					failure = error;
					stop();
				})
				.finally(() => {
					clearTimeout(timeout);
					active.delete(operation);
				});
			active.add(operation);
			count++;
		}
	} finally {
		signal.removeEventListener("abort", stop);
		await messages.close();
		await Promise.all(active);
	}
	if (failed) throw failure;
	return count;
}
