import { and, eq, gt } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import {
	operationalCapacity as capacity,
	operationalOutbox as outbox,
} from "../database/schema/operational-durability";
import { operationalRelayPending as pending } from "../database/schema/operational-runtime";

const budgetSchema = z.strictObject({
	routingBucket: z.number().int().min(0).max(1023),
	lane: z.enum(["event-outbox", "task-outbox", "task-intent", "receipt"]),
	maximumRows: z.bigint().min(1n).max(1000000000n),
	maximumBytes: z.bigint().min(1n).max(1000000000000000n),
});
/** Provision a finite budget without resetting charged credits or permitting a shrink below retained usage. @internal */
export async function configureOperationalBudget(
	tx: DatabaseTransaction,
	input: z.input<typeof budgetSchema>,
): Promise<void> {
	const budget = budgetSchema.parse(input);
	await tx
		.insert(capacity)
		.values(budget)
		.onConflictDoUpdate({
			target: [capacity.routingBucket, capacity.lane],
			set: { maximumRows: budget.maximumRows, maximumBytes: budget.maximumBytes },
		});
}
/** One explicit cutover page; trigger installation precedes this UUID keyset backfill. Replays preserve message IDs. @internal */
export async function backfillRelayPage(
	tx: DatabaseTransaction,
	input: { bucket: number; after: string | null; limit: number },
) {
	z.object({
		bucket: z.number().int().min(0).max(1023),
		after: z.uuid().nullable(),
		limit: z.number().int().min(1).max(100),
	}).parse(input);
	const rows = await tx
		.select({
			messageId: outbox.messageId,
			messageClass: outbox.messageClass,
			routingEpoch: outbox.routingEpoch,
		})
		.from(outbox)
		.where(
			and(
				eq(outbox.routingBucket, input.bucket),
				input.after ? gt(outbox.messageId, input.after) : undefined,
			),
		)
		.orderBy(outbox.messageId)
		.limit(input.limit);
	for (const row of rows)
		await tx
			.insert(pending)
			.values({ routingBucket: input.bucket, ...row })
			.onConflictDoNothing();
	return {
		count: rows.length,
		after: rows.at(-1)?.messageId ?? input.after,
		done: rows.length < input.limit,
	};
}
