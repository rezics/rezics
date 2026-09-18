import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseSession } from "../database";
import {
	catalogSourceRecord as records,
	catalogSourceCheckPlan as plans,
	catalogSourceSubscription as subscriptions,
} from "@rezics/schema/postgres/ingestion/source";
import {
	claimDueSourceChecks,
	finishCatalogSourceCheck,
	type CatalogSourceCheckLease,
	type CatalogSourceCheckOutcome,
} from "../catalog/source-scheduling";
import { aggregateRoutingBucket, eventEnvelopeSchema } from "./envelope";
import {
	admitOperationalTask,
	claimOperationalTask,
	completeOperationalTask,
	OperationalLeaseLost,
	parseTaskRequest,
	retryOperationalTask,
} from "./durability";
import { disposeOperationalDelivery } from "./failure";
import type { EventHandler } from "./consumer";
import type { StreamRoute } from "./topology";

const consumerKey = "catalog.source-check.v1";
const payloadSchema = z.strictObject({
	operationId: z.uuid(),
	consumerKey: z.literal(consumerKey),
	maximumAttempts: z.literal(3),
	deadline: z.iso.datetime({ offset: true }),
	sourceRecordId: z.uuid(),
	generation: z.number().int().positive(),
	planRevision: z.number().int().positive(),
	source: z.string().regex(/^[a-z][a-z0-9_.-]{0,95}$/),
	objectType: z.string().regex(/^[a-z][a-z0-9_.-]{0,95}$/),
	externalId: z.string().min(1).max(512),
});
/** The catalog owner chooses provider endpoints and produces a checked acquisition result. @internal */
export type AcquireSourceCheck = (
	lease: CatalogSourceCheckLease,
	signal: AbortSignal,
) => Promise<CatalogSourceCheckOutcome>;

/** Claim due business plans and admit four ready tasks in one transaction, before any network request. @internal */
export async function scheduleSourceCheckTasks(
	database: DatabaseSession,
	route: StreamRoute,
	signal: AbortSignal,
): Promise<number> {
	if (route.class !== "task") throw new TypeError("Source check scheduler needs the task route");
	signal.throwIfAborted();
	return database.transaction(async (tx) => {
		await tx.execute(
			sql`select set_config('statement_timeout','10000',true),set_config('transaction_timeout','20000',true)`,
		);
		const leases = await claimDueSourceChecks(tx, {
			bucket: route.bucket,
			now: new Date(),
			limit: 4,
		});
		for (const lease of leases) {
			signal.throwIfAborted();
			await admitOperationalTask(
				tx,
				eventEnvelopeSchema.parse({
					version: 1,
					messageId: randomUUID(),
					class: "task",
					kind: "source.check.execute",
					occurredAt: new Date().toISOString(),
					causationId: null,
					correlationId: null,
					routingEpoch: route.epoch,
					routingBucket: aggregateRoutingBucket("source_record", lease.sourceRecordId),
					aggregate: {
						owner: "source_record",
						key: lease.sourceRecordId,
						revision: String(lease.generation),
					},
					payload: {
						...lease,
						operationId: randomUUID(),
						consumerKey,
						maximumAttempts: 3,
						deadline: new Date(Date.now() + 110000).toISOString(),
					},
				}),
			);
		}
		signal.throwIfAborted();
		return leases.length;
	});
}

/** Two independent fences protect task execution and source-observation freshness across external I/O. @internal */
export function createSourceCheckHandler(
	database: DatabaseSession,
	route: StreamRoute,
	acquire: AcquireSourceCheck,
): EventHandler<unknown> {
	if (route.class !== "task") throw new TypeError("Source check handler needs the task route");
	return {
		route,
		durable: "catalog-source-checks-v1",
		kind: "source.check.execute",
		parsePayload: (value) => payloadSchema.parse(value),
		dispose: (failure, signal) => disposeOperationalDelivery(database, route, failure, signal),
		async apply({ envelope, payload, signal }) {
			const request = payloadSchema.parse(payload);
			if (
				envelope.aggregate.owner !== "source_record" ||
				envelope.aggregate.key !== request.sourceRecordId ||
				envelope.aggregate.revision !== String(request.generation)
			)
				throw new TypeError("Source check aggregate differs from admitted lease");
			const { identity } = parseTaskRequest(envelope);
			const claimed = await database.transaction((tx) => claimOperationalTask(tx, identity, 30000));
			if (claimed.status === "terminal") return claimed;
			if (claimed.status !== "claimed") return { status: "retry", delayMs: 1000 };
			try {
				const authorized = await database.transaction(async (tx) => {
					const [record] = await tx
						.select()
						.from(records)
						.where(eq(records.id, request.sourceRecordId))
						.for("update");
					const [plan] = await tx
						.select()
						.from(plans)
						.where(eq(plans.sourceRecordId, request.sourceRecordId));
					const [demand] = await tx
						.select({ mappingKey: subscriptions.mappingKey })
						.from(subscriptions)
						.where(
							and(
								eq(subscriptions.sourceRecordId, request.sourceRecordId),
								eq(subscriptions.state, "active"),
							),
						)
						.limit(1);
					return (
						record?.acquisitionGeneration === request.generation &&
						record.source === request.source &&
						record.objectType === request.objectType &&
						record.externalId === request.externalId &&
						plan?.revision === request.planRevision &&
						plan.state === "active" &&
						demand !== undefined
					);
				});
				signal.throwIfAborted();
				if (!authorized)
					return await database.transaction((tx) =>
						completeOperationalTask(
							tx,
							claimed.lease,
							"cancelled",
							"source_check_authority_changed",
							async () => {},
						),
					);
				const outcome = await acquire(request, signal);
				signal.throwIfAborted();
				return await database.transaction(async (tx) => {
					await tx.execute(
						sql`select set_config('statement_timeout','10000',true),set_config('transaction_timeout','20000',true)`,
					);
					return completeOperationalTask(
						tx,
						claimed.lease,
						"succeeded",
						"source_check_recorded",
						async (write) => {
							signal.throwIfAborted();
							await finishCatalogSourceCheck(write, request, outcome);
							signal.throwIfAborted();
						},
					);
				});
			} catch (error) {
				if (signal.aborted || error instanceof OperationalLeaseLost)
					return { status: "lease_lost" };
				try {
					return await database.transaction((tx) =>
						retryOperationalTask(tx, claimed.lease, 2000, "source_check_failed"),
					);
				} catch (retryError) {
					if (retryError instanceof OperationalLeaseLost) return { status: "lease_lost" };
					throw retryError;
				}
			}
		},
	};
}
