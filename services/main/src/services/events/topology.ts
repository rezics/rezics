import {
	AckPolicy,
	DeliverPolicy,
	DiscardPolicy,
	JetStreamApiCodes,
	JetStreamApiError,
	ReplayPolicy,
	RetentionPolicy,
	StorageType,
	type ConsumerConfig,
	type JetStreamManager,
	type StreamConfig,
} from "@nats-io/jetstream";
import { z } from "zod";
import { eventKindSchema, MAX_ENVELOPE_BYTES } from "./envelope";

export const DELIVERY_LIMITS = Object.freeze({
	batch: 32,
	batchBytes: 32 * MAX_ENVELOPE_BYTES,
	concurrency: 4,
	outstanding: 64,
	fetchMs: 1_000,
	ackWaitMs: 60_000,
	handlerMs: 30_000,
	maxAttempts: 10,
	maxRetryDelayMs: 60_000,
});
const routeSchema = z.strictObject({
	class: z.enum(["event", "task"]),
	epoch: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
	bucket: z.number().int().min(0).max(1023),
	maxBytes: z.number().int().min(MAX_ENVELOPE_BYTES).max(Number.MAX_SAFE_INTEGER),
	maxMessages: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
	maxConsumers: z.number().int().min(1).max(64),
	deployment: z.enum(["qualification", "production"]),
});

/** One bounded physical shard; configuration is operator-owned, never derived from a source payload. @internal */
export type StreamRoute = z.infer<typeof routeSchema>;

/** @internal */
export function streamConfig(input: StreamRoute): Partial<StreamConfig> & { name: string } {
	const route = routeSchema.parse(input);
	const family = route.class === "event" ? "events" : "tasks";
	return {
		name: `REZICS_${family.toUpperCase()}_E${route.epoch}_B${route.bucket}`,
		subjects: [`rezics.${family}.e${route.epoch}.b${route.bucket}.>`],
		retention: route.class === "event" ? RetentionPolicy.Limits : RetentionPolicy.Workqueue,
		storage: StorageType.File,
		discard: DiscardPolicy.New,
		max_age: route.class === "event" ? 72 * 60 * 60 * 1e9 : 0,
		max_bytes: route.maxBytes,
		max_msgs: route.maxMessages,
		max_msg_size: MAX_ENVELOPE_BYTES,
		max_consumers: route.maxConsumers,
		num_replicas: route.deployment === "production" ? 3 : 1,
		duplicate_window: 120 * 1e9,
		allow_rollup_hdrs: false,
		allow_msg_ttl: false,
		deny_delete: true,
		deny_purge: true,
	};
}

/** Exact task-kind filters prevent overlapping competing work-queue consumers. @internal */
export function consumerConfig(
	route: StreamRoute,
	durable: string,
	kind: string,
): Partial<ConsumerConfig> {
	routeSchema.parse(route);
	z.string()
		.regex(/^[a-z][a-z0-9_-]{0,63}$/)
		.parse(durable);
	eventKindSchema.parse(kind);
	return {
		durable_name: durable,
		filter_subject: `rezics.${route.class === "event" ? "events" : "tasks"}.e${route.epoch}.b${route.bucket}.${kind}`,
		ack_policy: AckPolicy.Explicit,
		deliver_policy: DeliverPolicy.All,
		replay_policy: ReplayPolicy.Instant,
		ack_wait: DELIVERY_LIMITS.ackWaitMs * 1e6,
		// Application attempts are finite; durable disposition must remain retryable after a crash.
		max_deliver: -1,
		max_ack_pending: DELIVERY_LIMITS.outstanding,
		max_waiting: 16,
		max_batch: DELIVERY_LIMITS.batch,
		max_bytes: DELIVERY_LIMITS.batchBytes,
		max_expires: DELIVERY_LIMITS.fetchMs * 1e6,
		num_replicas: route.deployment === "production" ? 3 : 1,
	};
}

function verifyConfig(actual: object, expected: object): void {
	for (const [key, value] of Object.entries(expected)) {
		if (JSON.stringify(Reflect.get(actual, key)) !== JSON.stringify(value)) {
			throw new Error(`JetStream configuration mismatch: ${key}`);
		}
	}
}

/** Create missing resources; never silently mutate existing retention or consumer progress. @internal */
export async function provisionTransport(
	manager: JetStreamManager,
	route: StreamRoute,
	durable: string,
	kind: string,
): Promise<string> {
	const stream = streamConfig(route);
	try {
		verifyConfig((await manager.streams.info(stream.name)).config, stream);
	} catch (error) {
		if (!(error instanceof JetStreamApiError) || error.code !== JetStreamApiCodes.StreamNotFound)
			throw error;
		await manager.streams.add(stream);
	}
	const consumer = consumerConfig(route, durable, kind);
	try {
		verifyConfig((await manager.consumers.info(stream.name, durable)).config, consumer);
	} catch (error) {
		if (!(error instanceof JetStreamApiError) || error.code !== JetStreamApiCodes.ConsumerNotFound)
			throw error;
		await manager.consumers.add(stream.name, consumer);
	}
	return stream.name;
}
