import { createHash } from "node:crypto";
import { and, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseExecutor, DatabaseTransaction } from "../database";
import {
	catalogSourceObservationFanout as fanout,
	catalogSourceRecord as records,
	catalogSourceMappingClaim as claims,
	catalogSourceSnapshot as snapshots,
} from "@rezics/schema/postgres/ingestion/source";
import type { EventHandler } from "../events/consumer";
import type { StreamRoute } from "../events/topology";
import { encodeEnvelope, eventEnvelopeSchema, type EventEnvelope } from "../events/envelope";
import {
	applyOperationalEvent,
	admitOperationalTask,
	claimOperationalTask,
	completeOperationalTask,
	parseTaskRequest,
} from "../events/durability";
import {
	SourceObservationPayloadSchema,
	SourceBindingChangedPayloadSchema,
	parseSourceObservationEvent,
} from "./source-events";
import {
	enqueueCatalogSourceObservationProposal,
	enqueueCatalogSourceBindingProposal,
} from "./source-proposals";

const taskSchema = SourceObservationPayloadSchema.extend({
	afterMappingKey: z.uuid().nullable(),
	operationId: z.uuid(),
	consumerKey: z.literal("catalog-source-fanout-v1"),
	maximumAttempts: z.literal(10),
	deadline: z.iso.datetime({ offset: true }),
});
const pageLimit = 32;

async function admitPage(
	tx: DatabaseTransaction,
	event: EventEnvelope,
	afterMappingKey: string | null,
) {
	const value = SourceObservationPayloadSchema.parse({
		sourceRecordId: event.payload.sourceRecordId,
		snapshotId: event.payload.snapshotId,
		contentSha256: event.payload.contentSha256,
		contractSha256: event.payload.contractSha256,
	});
	const operationId = crypto.randomUUID();
	await admitOperationalTask(
		tx,
		eventEnvelopeSchema.parse({
			...event,
			class: "task",
			messageId: operationId,
			kind: "source.observation.continue",
			causationId: event.messageId,
			occurredAt: new Date().toISOString(),
			payload: {
				...value,
				afterMappingKey,
				operationId,
				consumerKey: "catalog-source-fanout-v1",
				maximumAttempts: 10,
				deadline: new Date(Date.now() + 86_400_000).toISOString(),
			},
		}),
	);
}

async function applyPage(tx: DatabaseTransaction, envelope: EventEnvelope, signal: AbortSignal) {
	const value = taskSchema.parse(envelope.payload);
	const [source] = await tx
		.select()
		.from(records)
		.where(eq(records.id, value.sourceRecordId))
		.limit(1)
		.for("update");
	const [snapshot] = await tx
		.select()
		.from(snapshots)
		.where(
			and(eq(snapshots.sourceRecordId, value.sourceRecordId), eq(snapshots.id, value.snapshotId)),
		)
		.limit(1);
	if (
		!source ||
		!snapshot ||
		snapshot.contentSha256 !== value.contentSha256 ||
		snapshot.contractSha256 !== value.contractSha256
	)
		throw new Error("Source fan-out evidence differs from its committed snapshot");
	const key = and(
		eq(fanout.sourceRecordId, value.sourceRecordId),
		eq(fanout.snapshotId, value.snapshotId),
	);
	const [cursor] = await tx.select().from(fanout).where(key).limit(1).for("update");
	if (!cursor) throw new Error("Source fan-out cursor is missing");
	if (cursor.completedAt || cursor.afterMappingKey !== value.afterMappingKey) return;
	if (source.headSnapshotId !== snapshot.id || source.lastCheckOutcome === "tombstone") {
		await tx.update(fanout).set({ completedAt: new Date() }).where(key);
		return;
	}
	const page = await tx
		.select()
		.from(claims)
		.where(
			and(
				eq(claims.sourceRecordId, value.sourceRecordId),
				cursor.afterMappingKey ? gt(claims.mappingKey, cursor.afterMappingKey) : undefined,
			),
		)
		.orderBy(claims.mappingKey)
		.limit(pageLimit);
	for (const claim of page) {
		if (signal.aborted) throw signal.reason;
		if (claim.state !== "active") continue;
		await enqueueCatalogSourceObservationProposal(tx, {
			sourceRecordId: value.sourceRecordId,
			mappingKey: claim.mappingKey,
			snapshotId: value.snapshotId,
			mappingVersion: claim.mappingVersion,
			expectedBindingRevision: claim.bindingRevision,
			afterMappingKey: cursor.afterMappingKey,
		});
	}
	const last = page.at(-1);
	const complete = page.length < pageLimit;
	await tx
		.update(fanout)
		.set({
			afterMappingKey: last?.mappingKey ?? cursor.afterMappingKey,
			completedAt: complete ? new Date() : null,
		})
		.where(key);
	if (!complete && last) await admitPage(tx, envelope, last.mappingKey);
	if (signal.aborted) throw signal.reason;
}

/** @internal Events admit authoritative work; task receipts atomically cover each bounded fan-out page. */
export function createSourceHandlers(
	database: DatabaseExecutor,
	route: StreamRoute,
	dispose: EventHandler<unknown>["dispose"],
): EventHandler<unknown>[] {
	const kind = route.class === "event" ? "source.record.observed" : "source.observation.continue";
	const handlers: EventHandler<unknown>[] = [
		{
			route,
			kind,
			durable:
				route.class === "event" ? "catalog-source-observations-v1" : "catalog-source-fanout-v1",
			parsePayload: (value) =>
				route.class === "event"
					? SourceObservationPayloadSchema.parse(value)
					: taskSchema.parse(value),
			dispose,
			async apply({ envelope, signal }) {
				if (signal.aborted) throw signal.reason;
				if (
					envelope.aggregate.owner !== "source_record" ||
					envelope.aggregate.key !== envelope.payload.sourceRecordId ||
					envelope.routingBucket !== route.bucket ||
					envelope.routingEpoch !== route.epoch
				)
					throw new Error("Source fan-out route differs from its aggregate");
				return database.transaction(async (tx) => {
					await tx.execute(
						sql`select set_config('transaction_timeout', '25000', true), set_config('statement_timeout', '10000', true), set_config('lock_timeout', '5000', true)`,
					);
					if (route.class === "event") {
						const { payload } = parseSourceObservationEvent(envelope);
						return applyOperationalEvent(
							tx,
							{
								routingBucket: envelope.routingBucket,
								operationId: envelope.messageId,
								consumerKey: "catalog-source-observations-v1",
								requestFingerprint: createHash("sha256")
									.update(encodeEnvelope(envelope))
									.digest("hex"),
							},
							async (tx) => {
								const [snapshot] = await tx
									.select()
									.from(snapshots)
									.where(
										and(
											eq(snapshots.sourceRecordId, payload.sourceRecordId),
											eq(snapshots.id, payload.snapshotId),
										),
									)
									.limit(1);
								if (
									!snapshot ||
									snapshot.contentSha256 !== payload.contentSha256 ||
									snapshot.contractSha256 !== payload.contractSha256
								)
									throw new Error("Source event does not reference its committed snapshot");
								await tx
									.insert(fanout)
									.values({
										sourceRecordId: payload.sourceRecordId,
										snapshotId: payload.snapshotId,
									})
									.onConflictDoNothing();
								await admitPage(tx, envelope, null);
								if (signal.aborted) throw signal.reason;
							},
						);
					}
					const parsed = parseTaskRequest(envelope);
					taskSchema.parse(parsed.request);
					const claim = await claimOperationalTask(tx, parsed.identity, 30_000);
					if (claim.status === "terminal")
						return { status: "terminal" as const, receiptId: claim.receiptId };
					if (claim.status !== "claimed") return { status: "retry" as const, delayMs: 1000 };
					const completed = await completeOperationalTask(
						tx,
						claim.lease,
						"succeeded",
						"source_fanout_page",
						(tx) => applyPage(tx, envelope, signal),
					);
					return { status: "committed" as const, receiptId: completed.receiptId };
				});
			},
		},
	];
	if (route.class === "event")
		handlers.push({
			route,
			kind: "source.binding.changed",
			durable: "catalog-source-bindings-v1",
			parsePayload: (value) => SourceBindingChangedPayloadSchema.parse(value),
			dispose,
			async apply({ envelope, signal }) {
				if (signal.aborted) throw signal.reason;
				const payload = SourceBindingChangedPayloadSchema.parse(envelope.payload);
				if (
					envelope.class !== "event" ||
					envelope.kind !== "source.binding.changed" ||
					envelope.aggregate.owner !== "source_record" ||
					envelope.aggregate.revision !== String(payload.bindingRevision) ||
					envelope.routingBucket !== route.bucket ||
					envelope.routingEpoch !== route.epoch
				)
					throw new Error("Source binding event differs from its committed revision route");
				return database.transaction(async (tx) => {
					await tx.execute(
						sql`select set_config('transaction_timeout', '25000', true), set_config('statement_timeout', '10000', true), set_config('lock_timeout', '5000', true)`,
					);
					return applyOperationalEvent(
						tx,
						{
							routingBucket: envelope.routingBucket,
							operationId: envelope.messageId,
							consumerKey: "catalog-source-bindings-v1",
							requestFingerprint: createHash("sha256")
								.update(encodeEnvelope(envelope))
								.digest("hex"),
						},
						async (tx) => {
							await enqueueCatalogSourceBindingProposal(tx, {
								sourceRecordId: envelope.aggregate.key,
								...payload,
							});
							if (signal.aborted) throw signal.reason;
						},
					);
				});
			},
		});
	return handlers;
}
