import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import type { DatabaseSession, DatabaseTransaction } from "../database";
import { operationalApplicationReceipt as receipts } from "@rezics/schema/postgres/operations/operational-durability";
import {
	claimOperationalTask,
	completeOperationalTask,
	OperationalIdentityConflict,
	OperationalLeaseLost,
	parseTaskRequest,
} from "./durability";
import type { DeliveryFailure, DurableOutcome } from "./consumer";
import type { StreamRoute } from "./topology";

/** Deterministic UUID in a separate receipt namespace; hostile bodies never choose its identity. @internal */
export function quarantineIdentity(route: StreamRoute, failure: DeliveryFailure) {
	const hash = createHash("sha256")
		.update(`${failure.delivery.stream}/${failure.delivery.consumer}/${failure.delivery.sequence}`)
		.digest("hex");
	const operationId = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-8${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
	return {
		routingBucket: route.bucket,
		operationId,
		consumerKey: `quarantine.${failure.delivery.consumer}`,
		requestFingerprint: failure.delivery.payloadSha256,
	};
}

async function quarantine(
	tx: DatabaseTransaction,
	route: StreamRoute,
	failure: DeliveryFailure,
): Promise<DurableOutcome> {
	const identity = quarantineIdentity(route, failure);
	await tx.execute(
		sql`select pg_advisory_xact_lock(hashtextextended(${`quarantine:${identity.routingBucket}:${identity.operationId}`},0))`,
	);
	const [existing] = await tx
		.select()
		.from(receipts)
		.where(
			and(
				eq(receipts.routingBucket, identity.routingBucket),
				eq(receipts.consumerKey, identity.consumerKey),
				eq(receipts.operationId, identity.operationId),
			),
		);
	if (existing) {
		if (existing.requestFingerprint !== identity.requestFingerprint)
			throw new OperationalIdentityConflict();
	} else
		await tx
			.insert(receipts)
			.values({
				...identity,
				outcome: "failed",
				detail: JSON.stringify({
					reason: failure.reason,
					stream: failure.delivery.stream,
					sequence: failure.delivery.sequence,
					sha256: failure.delivery.payloadSha256,
				}),
			});
	return {
		status: existing ? "duplicate" : "terminal",
		receiptId: `${identity.consumerKey}/${identity.routingBucket}/${identity.operationId}`,
	};
}

/** Fails exact admitted tasks under a new fence; malformed inputs only create quarantined evidence. @internal */
export async function disposeOperationalDelivery(
	database: DatabaseSession,
	route: StreamRoute,
	failure: DeliveryFailure,
	signal: AbortSignal,
): Promise<DurableOutcome> {
	signal.throwIfAborted();
	try {
		return await database.transaction(async (tx) => {
			await tx.execute(
				sql`select set_config('statement_timeout','10000',true),set_config('transaction_timeout','15000',true)`,
			);
			if (failure.reason === "retry_exhausted" && failure.envelope?.class === "task") {
				const { identity } = parseTaskRequest(failure.envelope);
				const claim = await claimOperationalTask(tx, identity, 15000);
				if (claim.status === "terminal") return claim;
				if (claim.status === "missing") return quarantine(tx, route, failure);
				if (claim.status === "claimed")
					return completeOperationalTask(
						tx,
						claim.lease,
						"failed",
						"delivery_budget_exhausted",
						async () => {},
					);
				return { status: "lease_lost" };
			}
			return quarantine(tx, route, failure);
		});
	} catch (error) {
		if (error instanceof OperationalLeaseLost) return { status: "lease_lost" };
		if (error instanceof OperationalIdentityConflict)
			return database.transaction((tx) => quarantine(tx, route, failure));
		throw error;
	}
}
