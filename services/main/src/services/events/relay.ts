import { and, eq, sql } from "drizzle-orm";
import type { JetStreamClient } from "@nats-io/jetstream";
import type { DatabaseSession } from "../database";
import { operationalRelayPending as pending } from "../database/schema/operational-runtime";
import { operationalOutbox as outbox } from "../database/schema/operational-durability";
import { decodeEnvelope } from "./envelope";
import { publishEnvelope } from "./publisher";
import type { StreamRoute } from "./topology";

/** Bounded SQL fallback. Exact pending rows avoid skipping transactions that commit behind a cursor. @internal */
export async function relayOutboxBatch(
	database: DatabaseSession,
	client: Pick<JetStreamClient, "publish">,
	routes: readonly StreamRoute[],
	signal: AbortSignal,
): Promise<number> {
	if (routes.length < 1 || routes.length > 32)
		throw new RangeError("Relay assignment requires 1..32 routes");
	let count = 0;
	for (const route of routes) {
		if (signal.aborted) break;
		let batchFailure: { error: unknown } | undefined;
		count += await database.transaction(async (tx) => {
			await tx.execute(
				sql`select set_config('statement_timeout','8000',true), set_config('transaction_timeout','25000',true)`,
			);
			const rows = await tx
				.select({ messageId: pending.messageId, payload: outbox.serializedEnvelope })
				.from(pending)
				.innerJoin(
					outbox,
					and(
						eq(outbox.routingBucket, pending.routingBucket),
						eq(outbox.messageId, pending.messageId),
					),
				)
				.where(
					and(
						eq(pending.routingBucket, route.bucket),
						eq(pending.messageClass, route.class),
						eq(pending.routingEpoch, route.epoch),
					),
				)
				.orderBy(pending.createdAt, pending.messageId)
				.limit(4)
				.for("update", { of: pending, skipLocked: true });
			// The four ACK waits are independent. No database query runs concurrently on the transaction.
			const results = await Promise.allSettled(
				rows.map(async (row) => {
					signal.throwIfAborted();
					await publishEnvelope(
						client,
						route,
						decodeEnvelope(new TextEncoder().encode(row.payload)),
					);
					return row.messageId;
				}),
			);
			let published = 0;
			for (const result of results) {
				if (result.status === "fulfilled") {
					await tx
						.delete(pending)
						.where(
							and(eq(pending.routingBucket, route.bucket), eq(pending.messageId, result.value)),
						);
					published++;
				}
			}
			// Successful ACKs are checkpointed even if another publication failed. An uncertain ACK keeps its row.
			{
				const failed = results.find((result) => result.status === "rejected");
				if (failed?.status === "rejected") batchFailure = { error: failed.reason };
			}
			return published;
		});
		if (batchFailure) throw batchFailure.error;
	}
	return count;
}
