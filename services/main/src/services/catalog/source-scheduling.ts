import { and, eq, lte, or, isNull } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import {
	catalogSourceRecord as records,
	catalogSourceCheckPlan as plans,
	catalogSourceSubscription as subscriptions,
	catalogSourceCheckReceipt as receipts,
} from "@rezics/schema/postgres/ingestion/source";
import { aggregateRoutingBucket } from "../events/envelope";
import {
	type CatalogSourceAcquisition,
	beginCatalogSourceAcquisition,
	recordCatalogSourceObservation,
	type CatalogSourceReceipt,
} from "./source-observations";
import { appendSourceLifecycleEvent } from "./source-bindings";

/** @internal A check lease is committed before external I/O and fenced again on completion. */
export type CatalogSourceCheckLease = CatalogSourceAcquisition & {
	planRevision: number;
	source: string;
	objectType: string;
	externalId: string;
};

/** @internal Only public-source transport is currently admitted into shared acquisition. */
export async function planSourceCheck(
	tx: DatabaseTransaction,
	input: {
		sourceRecordId: string;
		visibilityScope: "public";
		nextCheckAt: Date;
		intervalSeconds: number;
		expectedRevision?: number;
	},
) {
	const value = z
		.strictObject({
			sourceRecordId: z.uuid(),
			visibilityScope: z.literal("public"),
			nextCheckAt: z.date(),
			intervalSeconds: z.number().int().min(60).max(2_592_000),
			expectedRevision: z.number().int().positive().optional(),
		})
		.parse(input);
	const [record] = await tx
		.select()
		.from(records)
		.where(eq(records.id, value.sourceRecordId))
		.limit(1)
		.for("update");
	if (!record) throw new Error("Source check record is missing");
	if (record.source === "openlibrary")
		throw new TypeError("Open Library uses human-requested lookups or bulk dumps, not recurring polling");
	const [existing] = await tx
		.select()
		.from(plans)
		.where(
			and(
				eq(plans.routingBucket, aggregateRoutingBucket("source_record", value.sourceRecordId)),
				eq(plans.sourceRecordId, value.sourceRecordId),
			),
		)
		.limit(1)
		.for("update");
	if (existing && existing.revision !== value.expectedRevision)
		throw new Error("Source check plan revision is stale");
	const revision = (existing?.revision ?? 0) + 1;
	await tx
		.insert(plans)
		.values({
			sourceRecordId: value.sourceRecordId,
			routingBucket: aggregateRoutingBucket("source_record", value.sourceRecordId),
			nextCheckAt: value.nextCheckAt,
			intervalSeconds: value.intervalSeconds,
			revision,
		})
		.onConflictDoUpdate({
			target: [plans.routingBucket, plans.sourceRecordId],
			set: {
				nextCheckAt: value.nextCheckAt,
				intervalSeconds: value.intervalSeconds,
				revision,
				leaseUntil: null,
				state: "active",
			},
		});
	return { revision };
}

/** @internal Bucket equality + due index + SKIP LOCKED bounds concurrent scheduler work. */
export async function claimDueSourceChecks(
	tx: DatabaseTransaction,
	input: { bucket: number; now: Date; limit?: number },
): Promise<CatalogSourceCheckLease[]> {
	const value = z
		.strictObject({
			bucket: z.number().int().min(0).max(1023),
			now: z.date(),
			limit: z.number().int().min(1).max(100).default(20),
		})
		.parse(input);
	const due = await tx
		.select()
		.from(plans)
		.where(
			and(
				eq(plans.routingBucket, value.bucket),
				eq(plans.state, "active"),
				lte(plans.nextCheckAt, value.now),
				or(isNull(plans.leaseUntil), lte(plans.leaseUntil, value.now)),
			),
		)
		.orderBy(plans.nextCheckAt, plans.sourceRecordId)
		.limit(value.limit);
	const leases: CatalogSourceCheckLease[] = [];
	for (const candidate of due) {
		const [lockedSource] = await tx
			.select()
			.from(records)
			.where(eq(records.id, candidate.sourceRecordId))
			.limit(1)
			.for("update", { skipLocked: true });
		if (!lockedSource) continue;
		const [plan] = await tx
			.select()
			.from(plans)
			.where(
				and(
					eq(plans.routingBucket, value.bucket),
					eq(plans.sourceRecordId, candidate.sourceRecordId),
					eq(plans.state, "active"),
					lte(plans.nextCheckAt, value.now),
					or(isNull(plans.leaseUntil), lte(plans.leaseUntil, value.now)),
				),
			)
			.limit(1)
			.for("update", { skipLocked: true });
		if (!plan) continue;
		const [demand] = await tx
			.select({ mappingKey: subscriptions.mappingKey })
			.from(subscriptions)
			.where(
				and(
					eq(subscriptions.sourceRecordId, plan.sourceRecordId),
					eq(subscriptions.state, "active"),
				),
			)
			.limit(1);
		if (!demand) {
			await tx
				.update(plans)
				.set({ nextCheckAt: new Date(value.now.getTime() + plan.intervalSeconds * 1000) })
				.where(
					and(
						eq(plans.routingBucket, aggregateRoutingBucket("source_record", plan.sourceRecordId)),
						eq(plans.sourceRecordId, plan.sourceRecordId),
					),
				);
			continue;
		}
		const [record] = await tx
			.select()
			.from(records)
			.where(eq(records.id, plan.sourceRecordId))
			.limit(1);
		if (!record) throw new Error("Source plan lost its identity");
		const acquisition = await beginCatalogSourceAcquisition(tx, {
			source: record.source,
			objectType: record.objectType,
			externalId: record.externalId,
		});
		await tx
			.update(plans)
			.set({
				leaseUntil: new Date(value.now.getTime() + 120_000),
				nextCheckAt: new Date(value.now.getTime() + plan.intervalSeconds * 1000),
			})
			.where(
				and(
					eq(plans.routingBucket, aggregateRoutingBucket("source_record", plan.sourceRecordId)),
					eq(plans.sourceRecordId, plan.sourceRecordId),
				),
			);
		leases.push({
			...acquisition,
			planRevision: plan.revision,
			source: record.source,
			objectType: record.objectType,
			externalId: record.externalId,
		});
	}
	return leases;
}

export type CatalogSourceCheckOutcome =
	| { status: "changed"; receipt: CatalogSourceReceipt }
	| { status: "unchanged" }
	| { status: "error"; reason: string }
	| { status: "tombstone"; reason: string; authoritative: true };

/** @internal Stale completions retain a receipt but never move a source head or schedule backwards. */
export async function finishCatalogSourceCheck(
	tx: DatabaseTransaction,
	lease: CatalogSourceCheckLease,
	outcome: CatalogSourceCheckOutcome,
) {
	z.uuid().parse(lease.sourceRecordId);
	z.number().int().positive().parse(lease.generation);
	const [record] = await tx
		.select()
		.from(records)
		.where(eq(records.id, lease.sourceRecordId))
		.limit(1)
		.for("update");
	const [plan] = await tx
		.select()
		.from(plans)
		.where(
			and(
				eq(plans.routingBucket, aggregateRoutingBucket("source_record", lease.sourceRecordId)),
				eq(plans.sourceRecordId, lease.sourceRecordId),
			),
		)
		.limit(1)
		.for("update");
	if (!record || !plan) throw new Error("Source check authority is missing");
	const [existing] = await tx
		.select()
		.from(receipts)
		.where(
			and(
				eq(receipts.sourceRecordId, lease.sourceRecordId),
				eq(receipts.generation, lease.generation),
			),
		)
		.limit(1);
	if (existing) return { status: "repeated" as const, outcome: existing.outcome };
	const stale =
		record.acquisitionGeneration !== lease.generation || plan.revision !== lease.planRevision;
	let disposition: typeof receipts.$inferInsert.outcome = stale ? "superseded" : outcome.status;
	const reason = "reason" in outcome ? z.string().min(1).max(2048).parse(outcome.reason) : null;
	if (!stale) {
		if (outcome.status === "changed") {
			if (
				outcome.receipt.acquisition?.sourceRecordId !== lease.sourceRecordId ||
				outcome.receipt.acquisition.generation !== lease.generation
			)
				throw new Error("Source result lacks the admitted acquisition fence");
			const result = await recordCatalogSourceObservation(tx, outcome.receipt);
			disposition = result.repeated ? "unchanged" : "changed";
		} else {
			if (outcome.status === "unchanged" && record.headSnapshotId === null)
				throw new Error("An initial source check cannot be unchanged without an observation");
			if (outcome.status === "tombstone" && outcome.authoritative !== true)
				throw new Error("Source disappearance is not an authoritative tombstone");
			await tx
				.update(records)
				.set({
					acceptedGeneration: lease.generation,
					lastCheckedAt: new Date(),
					lastCheckOutcome: outcome.status,
				})
				.where(eq(records.id, lease.sourceRecordId));
		}
		await tx
			.update(plans)
			.set({ leaseUntil: null })
			.where(
				and(
					eq(plans.routingBucket, aggregateRoutingBucket("source_record", lease.sourceRecordId)),
					eq(plans.sourceRecordId, lease.sourceRecordId),
				),
			);
	}
	await tx.insert(receipts).values({
		sourceRecordId: lease.sourceRecordId,
		generation: lease.generation,
		outcome: disposition,
		reason,
	});
	await appendSourceLifecycleEvent(
		tx,
		lease.sourceRecordId,
		"source.record.checked",
		lease.generation,
		{ generation: lease.generation, outcome: disposition },
	);
	return { status: "recorded" as const, outcome: disposition };
}
