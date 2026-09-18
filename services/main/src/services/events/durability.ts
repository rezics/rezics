import { createHash } from "node:crypto";
import { and, eq, gt, sql } from "drizzle-orm";
import { NodePgTransaction } from "drizzle-orm/node-postgres";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import {
	operationalApplicationReceipt as receipts,
	operationalOutbox as outbox,
	operationalTaskIntent as tasks,
} from "@rezics/schema/postgres/operations/operational-durability";
import { decodeEnvelope, encodeEnvelope, envelopeSubject } from "./envelope";

const taskRequestSchema = z
	.object({
		operationId: z.uuid(),
		consumerKey: z
			.string()
			.min(1)
			.max(128)
			.regex(/^[a-z0-9][a-z0-9:._-]*$/),
		maximumAttempts: z.number().int().min(1).max(32),
		deadline: z.iso.datetime({ offset: true }),
	})
	.passthrough();
const identitySchema = z.object({
	routingBucket: z.number().int().min(0).max(1023),
	operationId: z.uuid(),
	consumerKey: z.string().min(1).max(128),
	requestFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
});

/** @internal Semantic task identity survives transport republishing and routing epochs. */
export type TaskIdentity = z.infer<typeof identitySchema>;
/** @internal A token is valid only while the matching database lease remains live. */
export type TaskLease = TaskIdentity & { readonly fencingGeneration: bigint };
type TerminalOutcome = "succeeded" | "cancelled" | "failed" | "superseded";
type TerminalProof = {
	readonly status: "terminal";
	readonly outcome: TerminalOutcome;
	readonly receiptId: string;
};

/** @internal Never acknowledge a message when this error rolls its transaction back. */
export class OperationalLeaseLost extends Error {
	constructor() {
		super("Operational task lease was lost");
		this.name = "OperationalLeaseLost";
	}
}
/** @internal Stable operation/message identifiers cannot be reused for a different request. */
export class OperationalIdentityConflict extends Error {
	constructor() {
		super("Operational identifier was reused with different immutable content");
		this.name = "OperationalIdentityConflict";
	}
}

function transactionOnly(tx: DatabaseTransaction): void {
	if (!(tx instanceof NodePgTransaction))
		throw new TypeError("Operational writes require an explicit database transaction");
}

function canonical(value: unknown): string {
	if (value === null || typeof value !== "object") return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
	return `{${Object.entries(value)
		.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
		.map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`)
		.join(",")}}`;
}

/** @internal Parsing comes from transport authority, then this owner proves task semantics. */
export function parseTaskRequest(input: unknown) {
	const envelope = decodeEnvelope(encodeEnvelope(input));
	if (envelope.class !== "task") throw new TypeError("Task admission requires a task envelope");
	const request = taskRequestSchema.parse(envelope.payload);
	const fingerprint = createHash("sha256")
		.update(
			canonical({
				kind: envelope.kind,
				aggregate: envelope.aggregate,
				payload: envelope.payload,
				routingBucket: envelope.routingBucket,
			}),
		)
		.digest("hex");
	return {
		envelope,
		request,
		identity: {
			routingBucket: envelope.routingBucket,
			operationId: request.operationId,
			consumerKey: request.consumerKey,
			requestFingerprint: fingerprint,
		},
	};
}

function taskKey(identity: TaskIdentity) {
	return and(
		eq(tasks.routingBucket, identity.routingBucket),
		eq(tasks.operationId, identity.operationId),
	);
}
function receiptKey(identity: TaskIdentity) {
	return and(
		eq(receipts.routingBucket, identity.routingBucket),
		eq(receipts.operationId, identity.operationId),
		eq(receipts.consumerKey, identity.consumerKey),
	);
}
function currentLease(lease: TaskLease) {
	identitySchema.parse(lease);
	if (typeof lease.fencingGeneration !== "bigint" || lease.fencingGeneration < 1n)
		throw new TypeError("Invalid fencing generation");
	return and(
		taskKey(lease),
		eq(tasks.consumerKey, lease.consumerKey),
		eq(tasks.requestFingerprint, lease.requestFingerprint),
		eq(tasks.state, "running"),
		eq(tasks.fencingGeneration, lease.fencingGeneration),
		gt(tasks.leaseExpiresAt, sql`clock_timestamp()`),
		gt(tasks.deadline, sql`clock_timestamp()`),
	);
}
function receiptId(identity: TaskIdentity) {
	return `${identity.consumerKey}/${identity.routingBucket}/${identity.operationId}`;
}
function assertFingerprint(
	row: { consumerKey: string; requestFingerprint: string },
	identity: TaskIdentity,
) {
	if (
		row.consumerKey !== identity.consumerKey ||
		row.requestFingerprint !== identity.requestFingerprint
	)
		throw new OperationalIdentityConflict();
}

/** @internal Max 100 entries and 1 MiB per atomic write; capacity triggers reserve retained storage. */
export async function appendOperationalOutbox(
	tx: DatabaseTransaction,
	inputs: readonly unknown[],
): Promise<void> {
	transactionOnly(tx);
	return tx.transaction(async (tx) => {
		if (inputs.length < 1 || inputs.length > 100)
			throw new RangeError("Outbox batch must contain 1..100 messages");
		let bytes = 0;
		const envelopes = inputs.map((input) => {
			const encoded = encodeEnvelope(input);
			bytes += encoded.byteLength;
			return decodeEnvelope(encoded);
		});
		if (bytes > 1_048_576) throw new RangeError("Outbox transaction exceeds 1 MiB");
		envelopes.sort(
			(a, b) =>
				a.routingBucket - b.routingBucket ||
				a.class.localeCompare(b.class) ||
				a.messageId.localeCompare(b.messageId),
		);
		for (const envelope of envelopes) {
			// INSERT ... DO NOTHING waits for concurrent same-key writers without allocating credits twice.
			const [inserted] = await tx
				.insert(outbox)
				.values({
					routingBucket: envelope.routingBucket,
					messageId: envelope.messageId,
					messageClass: envelope.class,
					kind: envelope.kind,
					routingEpoch: envelope.routingEpoch,
					subject: envelopeSubject(envelope),
					aggregateKey: envelope.aggregate.key,
					occurredAt: sql`${envelope.occurredAt}::timestamptz`,
					payload: envelope,
					serializedEnvelope: JSON.stringify(envelope),
				})
				.onConflictDoNothing()
				.returning({ messageId: outbox.messageId });
			if (!inserted) {
				const [existing] = await tx
					.select({ payload: outbox.payload })
					.from(outbox)
					.where(
						and(
							eq(outbox.routingBucket, envelope.routingBucket),
							eq(outbox.messageId, envelope.messageId),
						),
					);
				if (!existing || canonical(existing.payload) !== canonical(envelope))
					throw new OperationalIdentityConflict();
			}
		}
	});
}

/** @internal Call in the planner's transaction; the caller must commit before acknowledging its input. */
export async function admitOperationalTask(
	tx: DatabaseTransaction,
	input: unknown,
): Promise<TaskIdentity> {
	transactionOnly(tx);
	return tx.transaction(async (tx) => {
		const { envelope, request, identity } = parseTaskRequest(input);
		// A bounded exact-key lock serializes admission, including the absent-row case.
		await tx.execute(
			sql`select pg_advisory_xact_lock(hashtextextended(${`operational-task:${identity.routingBucket}:${identity.operationId}`}, 0))`,
		);
		const [existing] = await tx.select().from(tasks).where(taskKey(identity));
		if (existing) {
			assertFingerprint(existing, identity);
			return identity;
		}
		await appendOperationalOutbox(tx, [envelope]);
		await tx.insert(tasks).values({
			...identity,
			originMessageId: envelope.messageId,
			maximumAttempts: request.maximumAttempts,
			deadline: sql`${request.deadline}::timestamptz`,
		});
		return identity;
	});
}

async function writeTaskReceipt(
	tx: DatabaseTransaction,
	identity: TaskIdentity,
	outcome: TerminalOutcome,
	detail: string,
): Promise<TerminalProof> {
	if (Buffer.byteLength(detail, "utf8") > 512)
		throw new RangeError("Terminal detail exceeds 512 bytes");
	await tx
		.insert(receipts)
		.values({ ...identity, taskOperationId: identity.operationId, outcome, detail });
	return { status: "terminal", outcome, receiptId: receiptId(identity) };
}

function leaseDuration(milliseconds: number): void {
	if (!Number.isSafeInteger(milliseconds) || milliseconds < 1 || milliseconds > 300_000)
		throw new RangeError("Lease duration must be 1..300000 milliseconds");
}

/** @internal Resolve only a delivered operation ID. This function does not discover ready work. */
export async function claimOperationalTask(
	tx: DatabaseTransaction,
	input: TaskIdentity,
	leaseMilliseconds: number,
): Promise<
	| { status: "claimed"; lease: TaskLease }
	| { status: "busy" | "missing" | "deferred" }
	| TerminalProof
> {
	transactionOnly(tx);
	const identity = identitySchema.parse(input);
	leaseDuration(leaseMilliseconds);
	const [task] = await tx.select().from(tasks).where(taskKey(identity)).for("update");
	if (!task) return { status: "missing" };
	assertFingerprint(task, identity);
	// Row-lock waits can cross a deadline without changing the row: sample time after acquiring it.
	const [timing] = await tx
		.select({
			expired: sql<boolean>`${tasks.leaseExpiresAt} <= clock_timestamp()`,
			due: sql<boolean>`${tasks.availableAt} <= clock_timestamp()`,
			deadlinePassed: sql<boolean>`${tasks.deadline} <= clock_timestamp()`,
		})
		.from(tasks)
		.where(taskKey(identity));
	if (!timing) throw new Error("Locked task disappeared");
	const row = { task, ...timing };
	if (!["pending", "running"].includes(row.task.state)) {
		const [receipt] = await tx.select().from(receipts).where(receiptKey(identity));
		if (!receipt) throw new Error("Terminal task is missing application receipt");
		assertFingerprint(receipt, identity);
		return { status: "terminal", outcome: receipt.outcome, receiptId: receiptId(identity) };
	}
	if (row.task.state === "running" && !row.expired && !row.deadlinePassed)
		return { status: "busy" };
	if (row.deadlinePassed || row.task.attemptCount >= row.task.maximumAttempts) {
		await tx
			.update(tasks)
			.set({ state: "failed", leaseExpiresAt: null, lastError: "execution_budget_exhausted" })
			.where(taskKey(identity));
		return writeTaskReceipt(tx, identity, "failed", "execution_budget_exhausted");
	}
	if (!row.due) return { status: "deferred" };
	const [claimed] = await tx
		.update(tasks)
		.set({
			state: "running",
			fencingGeneration: sql`${tasks.fencingGeneration} + 1`,
			attemptCount: sql`${tasks.attemptCount} + 1`,
			leaseExpiresAt: sql`least(${tasks.deadline}, clock_timestamp() + ${leaseMilliseconds} * interval '1 millisecond')`,
		})
		.where(taskKey(identity))
		.returning({ fencingGeneration: tasks.fencingGeneration });
	if (!claimed) throw new Error("Locked task disappeared");
	return {
		status: "claimed",
		lease: { ...identity, fencingGeneration: claimed.fencingGeneration },
	};
}

/** @internal A renewal cannot resurrect an expired claim, even before another worker claims it. */
export async function renewOperationalTask(
	tx: DatabaseTransaction,
	lease: TaskLease,
	leaseMilliseconds: number,
): Promise<void> {
	transactionOnly(tx);
	leaseDuration(leaseMilliseconds);
	const [row] = await tx
		.update(tasks)
		.set({
			leaseExpiresAt: sql`least(${tasks.deadline}, clock_timestamp() + ${leaseMilliseconds} * interval '1 millisecond')`,
		})
		.where(currentLease(lease))
		.returning({ operationId: tasks.operationId });
	if (!row) throw new OperationalLeaseLost();
}

/** @internal The mutation callback must perform only local transactional work and final authority/revision checks. */
export async function completeOperationalTask(
	tx: DatabaseTransaction,
	lease: TaskLease,
	outcome: TerminalOutcome,
	detail: string,
	mutate: (tx: DatabaseTransaction) => Promise<void>,
): Promise<TerminalProof> {
	transactionOnly(tx);
	return tx.transaction(async (tx) => {
		const [locked] = await tx
			.select({ operationId: tasks.operationId })
			.from(tasks)
			.where(currentLease(lease))
			.for("update");
		if (!locked) throw new OperationalLeaseLost();
		await mutate(tx);
		// Check after all mutation/outbox work: an executor that exceeded its lease rolls everything back.
		const [completed] = await tx
			.update(tasks)
			.set({
				state: outcome,
				leaseExpiresAt: null,
				lastError: outcome === "failed" ? detail : null,
			})
			.where(currentLease(lease))
			.returning({ operationId: tasks.operationId });
		if (!completed) throw new OperationalLeaseLost();
		return writeTaskReceipt(tx, lease, outcome, detail);
	});
}

/** @internal Retry retains the broker delivery; caller NAKs only after commit, never ACKs. */
export async function retryOperationalTask(
	tx: DatabaseTransaction,
	lease: TaskLease,
	delayMilliseconds: number,
	detail: string,
): Promise<{ status: "retry"; delayMs: number } | TerminalProof> {
	transactionOnly(tx);
	if (
		!Number.isSafeInteger(delayMilliseconds) ||
		delayMilliseconds < 1 ||
		delayMilliseconds > 900_000 ||
		Buffer.byteLength(detail) > 512
	)
		throw new RangeError("Retry delay/detail exceeds bounds");
	const [row] = await tx.select().from(tasks).where(currentLease(lease)).for("update");
	if (!row) throw new OperationalLeaseLost();
	if (row.attemptCount >= row.maximumAttempts)
		return completeOperationalTask(tx, lease, "failed", detail, async () => {});
	const [retried] = await tx
		.update(tasks)
		.set({
			state: "pending",
			leaseExpiresAt: null,
			availableAt: sql`least(${tasks.deadline},clock_timestamp() + ${delayMilliseconds} * interval '1 millisecond')`,
			lastError: detail,
		})
		.where(currentLease(lease))
		.returning({ operationId: tasks.operationId });
	if (!retried) throw new OperationalLeaseLost();
	return { status: "retry", delayMs: delayMilliseconds };
}

/** @internal Receipt and callback share a transaction; duplicate deliveries do not execute the callback. */
export async function applyOperationalEvent(
	tx: DatabaseTransaction,
	input: TaskIdentity,
	mutate: (tx: DatabaseTransaction) => Promise<void>,
): Promise<{ status: "committed" | "duplicate"; receiptId: string }> {
	transactionOnly(tx);
	const identity = identitySchema.parse(input);
	return tx.transaction(async (tx) => {
		await tx.execute(
			sql`select pg_advisory_xact_lock(hashtextextended(${`operational-receipt:${identity.routingBucket}:${identity.consumerKey}:${identity.operationId}`}, 0))`,
		);
		const [receipt] = await tx.select().from(receipts).where(receiptKey(identity));
		if (receipt) {
			assertFingerprint(receipt, identity);
			return { status: "duplicate", receiptId: receiptId(identity) };
		}
		await mutate(tx);
		await tx.insert(receipts).values({ ...identity, outcome: "succeeded", detail: "applied" });
		return { status: "committed", receiptId: receiptId(identity) };
	});
}
