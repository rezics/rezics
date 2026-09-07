import { and, eq, gt } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseExecutor } from "../database";
import {
	catalogSourceObservationFanout as fanout,
	catalogSourceRecord as records,
	catalogSourceMappingClaim as claims,
	catalogSourceSnapshot as snapshots,
} from "../database/schema/catalog-source";
import { CatalogIdentityTables } from "../database/schema/catalog-identity";
import { CatalogFactTables } from "../database/schema/catalog-facts";
import type { EventHandler } from "../events/consumer";
import type { StreamRoute } from "../events/topology";
import { eventEnvelopeSchema } from "../events/envelope";
import { appendOperationalOutbox } from "../events/durability";
import { SourceObservationPayloadSchema, parseSourceObservationEvent } from "./source-events";
import { proposeCatalogSourceAdoption } from "./source-proposals";

const continuationSchema = SourceObservationPayloadSchema.extend({ afterMappingKey: z.uuid() });

/** @internal Durable bounded fan-out: commit proposals, cursor and continuation together before ACK. */
export function createSourceHandlers(
	database: DatabaseExecutor,
	route: StreamRoute,
	dispose: EventHandler<unknown>["dispose"],
): EventHandler<unknown>[] {
	if (route.class !== "event") return [];
	return ["source.record.observed", "source.observation.continue"].map(
		(kind): EventHandler<unknown> => ({
			route,
			kind,
			durable:
				kind === "source.record.observed"
					? "catalog-source-observations-v1"
					: "catalog-source-fanout-v1",
			parsePayload: (value) =>
				kind === "source.record.observed"
					? SourceObservationPayloadSchema.parse(value)
					: continuationSchema.parse(value),
			dispose,
			async apply({ envelope, payload, signal }) {
				if (signal.aborted) throw signal.reason;
				const value =
					kind === "source.record.observed"
						? parseSourceObservationEvent(envelope).payload
						: continuationSchema.parse(payload);
				if (
					envelope.aggregate.owner !== "source_record" ||
					envelope.aggregate.key !== value.sourceRecordId ||
					envelope.routingBucket !== route.bucket ||
					envelope.routingEpoch !== route.epoch
				)
					throw new Error("Source fan-out route differs from its aggregate");
				return database.transaction(async (tx) => {
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
							and(
								eq(snapshots.sourceRecordId, value.sourceRecordId),
								eq(snapshots.id, value.snapshotId),
							),
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
					await tx
						.insert(fanout)
						.values({ sourceRecordId: value.sourceRecordId, snapshotId: value.snapshotId })
						.onConflictDoNothing();
					const [cursor] = await tx.select().from(fanout).where(key).limit(1).for("update");
					if (!cursor) throw new Error("Source fan-out cursor insertion failed");
					const receiptId = `${value.sourceRecordId}/${value.snapshotId}/${envelope.messageId}`;
					if (cursor.completedAt) return { status: "duplicate" as const, receiptId };
					if (source.headSnapshotId !== snapshot.id || source.lastCheckOutcome === "tombstone") {
						await tx.update(fanout).set({ completedAt: new Date() }).where(key);
						return { status: "terminal" as const, receiptId };
					}
					if (
						kind === "source.observation.continue" &&
						continuationSchema.parse(payload).afterMappingKey !== cursor.afterMappingKey
					)
						return { status: "duplicate" as const, receiptId };
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
						.limit(100);
					for (const claim of page) {
						if (signal.aborted) throw signal.reason;
						if (claim.state !== "active") continue;
						const table = CatalogFactTables[claim.owner].sourceBinding;
						const identity = CatalogIdentityTables[claim.owner];
						const [target] = await tx
							.select({ actor: identity.createdByAuthUserId })
							.from(table)
							.innerJoin(identity, eq(identity.id, table.ownerId))
							.where(
								and(
									eq(table.sourceRecordId, value.sourceRecordId),
									eq(table.mappingKey, claim.mappingKey),
								),
							)
							.limit(1);
						if (!target?.actor) continue;
						await proposeCatalogSourceAdoption(tx, target.actor, {
							sourceRecordId: value.sourceRecordId,
							mappingKey: claim.mappingKey,
							snapshotId: value.snapshotId,
							mappingVersion: claim.mappingVersion,
						});
					}
					const last = page.at(-1);
					const complete = page.length < 100;
					await tx
						.update(fanout)
						.set({
							afterMappingKey: last?.mappingKey ?? cursor.afterMappingKey,
							completedAt: complete ? new Date() : null,
						})
						.where(key);
					if (!complete && last)
						await appendOperationalOutbox(tx, [
							eventEnvelopeSchema.parse({
								...envelope,
								messageId: crypto.randomUUID(),
								kind: "source.observation.continue",
								causationId: envelope.messageId,
								occurredAt: new Date().toISOString(),
								payload: {
									sourceRecordId: value.sourceRecordId,
									snapshotId: value.snapshotId,
									contentSha256: value.contentSha256,
									contractSha256: value.contractSha256,
									afterMappingKey: last.mappingKey,
								},
							}),
						]);
					return { status: "committed" as const, receiptId };
				});
			},
		}),
	);
}
