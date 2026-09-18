import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import type { JetStreamManager } from "@nats-io/jetstream";
import type { DatabaseSession } from "../database";
import { operationalConsumerCheckpoint as checkpoints } from "@rezics/schema/postgres/operations/operational-runtime";
import { streamConfig, type StreamRoute } from "./topology";

/** Retention gaps and stream recreation fail closed until an explicit owner rebuild establishes a new generation. @internal */
export class EventReplayRequired extends Error {
	constructor() {
		super("Consumer requires authoritative replay before resuming");
		this.name = "EventReplayRequired";
	}
}

/** Conservatively checkpoint the broker's contiguous ACK floor, never merely the highest completed delivery. @internal */
export async function checkConsumerRetention(
	database: DatabaseSession,
	manager: JetStreamManager,
	route: StreamRoute,
	durable: string,
): Promise<void> {
	const name = streamConfig(route).name;
	// Consumer state must be sampled after the stream head: the inverse race could
	// mistake a newly appended but unread message for an already drained subject gap.
	const stream = await manager.streams.info(name);
	const consumer = await manager.consumers.info(name, durable);
	const key = and(
		eq(checkpoints.routingBucket, route.bucket),
		eq(checkpoints.messageClass, route.class),
		eq(checkpoints.consumerKey, durable),
	);
	const gap = await database.transaction(async (tx) => {
		await tx.execute(
			sql`select pg_advisory_xact_lock(hashtextextended(${`event-checkpoint:${route.bucket}:${route.class}:${durable}`},0))`,
		);
		const [previous] = await tx.select().from(checkpoints).where(key);
		// A fresh durable cannot certify expired events. Task WorkQueue deletion is expected after durable receipts.
		const initialSequence = route.class === "event" ? 1 : Math.max(1, stream.state.first_seq);
		const next = previous?.nextSequence ?? initialSequence;
		const missing =
			previous?.state === "replay_required" ||
			(previous !== undefined &&
				(previous.streamCreatedAt !== stream.created || previous.routingEpoch !== route.epoch)) ||
			(route.class === "event" && stream.state.first_seq > next);
		const value = {
			routingBucket: route.bucket,
			messageClass: route.class,
			consumerKey: durable,
			consumerSlot: createHash("sha256").update(durable).digest().readUInt16BE(0) % 64,
			routingEpoch: route.epoch,
			streamCreatedAt: stream.created,
			nextSequence: missing
				? next
				: Math.max(
						next,
						consumer.num_pending === 0 && consumer.num_ack_pending === 0
							? stream.state.last_seq + 1
							: consumer.ack_floor.stream_seq + 1,
					),
			state: missing ? ("replay_required" as const) : ("active" as const),
			updatedAt: new Date(),
		};
		await tx
			.insert(checkpoints)
			.values(value)
			.onConflictDoUpdate({
				target: [checkpoints.routingBucket, checkpoints.messageClass, checkpoints.consumerKey],
				set: value,
			});
		return missing;
	});
	if (gap) throw new EventReplayRequired();
}
