import { and, asc, eq, gt, inArray, lte, sql } from "drizzle-orm";
import type { DeliveryLocale } from "@rezics/i18n";

import { database, type DatabaseTransaction } from "../database";
import { emailOutbox, notification } from "../database/schema";
import type { MailAcceptance } from "./transport";

export type AuthenticationEmailKind = "reset_password" | "verify_email";

export async function enqueueAuthenticationEmail(input: {
	readonly actionUrl: string;
	readonly kind: AuthenticationEmailKind;
	readonly locale: DeliveryLocale;
	readonly recipientEmail: string;
}): Promise<string> {
	const [created] = await database
		.insert(emailOutbox)
		.values({
			actionUrl: input.actionUrl,
			kind: input.kind,
			locale: input.locale,
			recipientEmail: input.recipientEmail,
		})
		.returning({ id: emailOutbox.id });
	if (!created) throw new Error("Authentication email outbox insertion returned no row");
	return created.id;
}

export async function enqueueNotificationEmail(
	tx: DatabaseTransaction,
	notificationId: string,
): Promise<void> {
	await tx
		.insert(emailOutbox)
		.values({ kind: "notification", notificationId })
		.onConflictDoNothing();
}

export interface ClaimEmailBatchOptions {
	readonly batchSize: number;
	readonly leaseDurationMs: number;
}

export async function claimEmailBatch(options: ClaimEmailBatchOptions) {
	if (!Number.isSafeInteger(options.batchSize) || options.batchSize < 1 || options.batchSize > 100)
		throw new RangeError("Email claim batch size must be between 1 and 100");
	if (!Number.isSafeInteger(options.leaseDurationMs) || options.leaseDurationMs < 1)
		throw new RangeError("Email lease duration must be a positive integer");
	return database.transaction(async (tx) => {
		// Separate index-ordered scans avoid sorting the entire ready/expired union.
		const expired = await tx
			.select({ id: emailOutbox.id })
			.from(emailOutbox)
			.where(
				and(
					eq(emailOutbox.status, "processing"),
					lte(emailOutbox.leaseExpiresAt, sql`statement_timestamp()`),
				),
			)
			.orderBy(asc(emailOutbox.leaseExpiresAt))
			.limit(options.batchSize)
			.for("update", { skipLocked: true });
		const remaining = options.batchSize - expired.length;
		const pending =
			remaining > 0
				? await tx
						.select({ id: emailOutbox.id })
						.from(emailOutbox)
						.where(
							and(
								eq(emailOutbox.status, "pending"),
								lte(emailOutbox.availableAt, sql`statement_timestamp()`),
							),
						)
						.orderBy(asc(emailOutbox.availableAt), asc(emailOutbox.createdAt))
						.limit(remaining)
						.for("update", { skipLocked: true })
				: [];
		const ids = [...expired, ...pending].map(({ id }) => id);
		if (ids.length === 0) return [];
		return tx
			.update(emailOutbox)
			.set({
				attemptCount: sql`${emailOutbox.attemptCount} + 1`,
				lastError: null,
				leaseExpiresAt: sql`clock_timestamp() + ${options.leaseDurationMs} * interval '1 millisecond'`,
				status: "processing",
				updatedAt: sql`clock_timestamp()`,
			})
			.where(inArray(emailOutbox.id, ids))
			.returning();
	});
}

export type ClaimedEmail = Awaited<ReturnType<typeof claimEmailBatch>>[number];

/** @internal A claim cannot mutate queue or notification state after expiry or reclamation. */
export class EmailLeaseLost extends Error {
	constructor(id: string) {
		super(`Email outbox lease was lost for ${id}`);
		this.name = "EmailLeaseLost";
	}
}

function currentClaim(item: Pick<ClaimedEmail, "id" | "attemptCount">) {
	return and(
		eq(emailOutbox.id, item.id),
		eq(emailOutbox.status, "processing"),
		eq(emailOutbox.attemptCount, item.attemptCount),
		gt(emailOutbox.leaseExpiresAt, sql`clock_timestamp()`),
	);
}

/** @internal Recheck ownership after rendering and immediately before the external send. */
export async function renewEmailLease(item: ClaimedEmail, leaseDurationMs: number): Promise<void> {
	if (!Number.isSafeInteger(leaseDurationMs) || leaseDurationMs < 1)
		throw new RangeError("Email lease duration must be a positive integer");
	const [renewed] = await database
		.update(emailOutbox)
		.set({
			leaseExpiresAt: sql`clock_timestamp() + ${leaseDurationMs} * interval '1 millisecond'`,
			updatedAt: sql`clock_timestamp()`,
		})
		.where(currentClaim(item))
		.returning({ id: emailOutbox.id });
	if (!renewed) throw new EmailLeaseLost(item.id);
}

type EmailOutboxStateUpdate = Partial<
	Pick<
		typeof emailOutbox.$inferInsert,
		| "acceptedAt"
		| "actionUrl"
		| "availableAt"
		| "failedAt"
		| "lastError"
		| "leaseExpiresAt"
		| "providerMessageId"
		| "providerStatus"
		| "recipientEmail"
		| "locale"
		| "status"
		| "updatedAt"
	>
>;

async function requireClaimedUpdate(
	tx: DatabaseTransaction,
	input: {
		readonly item: ClaimedEmail;
		readonly set: EmailOutboxStateUpdate;
	},
) {
	const [updated] = await tx
		.update(emailOutbox)
		.set(input.set)
		.where(currentClaim(input.item))
		.returning({ id: emailOutbox.id });
	if (!updated) throw new EmailLeaseLost(input.item.id);
}

export async function markEmailAccepted(
	item: ClaimedEmail,
	acceptance: MailAcceptance,
	now: Date,
): Promise<void> {
	await database.transaction(async (tx) => {
		await requireClaimedUpdate(tx, {
			item,
			set: {
				acceptedAt: now,
				actionUrl: null,
				leaseExpiresAt: null,
				locale: null,
				providerMessageId: acceptance.providerMessageId,
				providerStatus: acceptance.status,
				recipientEmail: null,
				status: "accepted",
				updatedAt: now,
			},
		});
		if (item.notificationId)
			await tx
				.update(notification)
				.set({ emailError: null, emailedAt: now, emailStatus: "sent" })
				.where(
					and(eq(notification.id, item.notificationId), eq(notification.emailStatus, "pending")),
				);
	});
}

export function retryDelayMilliseconds(attemptCount: number, jitter: number): number {
	const boundedAttempt = Math.max(1, Math.min(attemptCount, 12));
	const exponential = Math.min(5_000 * 2 ** (boundedAttempt - 1), 15 * 60_000);
	return exponential + Math.floor(Math.max(0, Math.min(jitter, 0.999_999)) * 1_000);
}

export async function markEmailFailed(
	item: ClaimedEmail,
	input: {
		readonly error: string;
		readonly maxAttempts: number;
		readonly now: Date;
		readonly retryable: boolean;
		readonly retryJitter?: number;
	},
): Promise<"failed" | "retry_scheduled"> {
	const error = input.error.slice(0, 2_000) || "Unknown email delivery failure";
	const shouldRetry = input.retryable && item.attemptCount < input.maxAttempts;
	await database.transaction(async (tx) => {
		if (shouldRetry) {
			await requireClaimedUpdate(tx, {
				item,
				set: {
					availableAt: new Date(
						input.now.getTime() +
							retryDelayMilliseconds(item.attemptCount, input.retryJitter ?? Math.random()),
					),
					lastError: error,
					leaseExpiresAt: null,
					status: "pending",
					updatedAt: input.now,
				},
			});
			return;
		}
		await requireClaimedUpdate(tx, {
			item,
			set: {
				actionUrl: null,
				failedAt: input.now,
				lastError: error,
				leaseExpiresAt: null,
				locale: null,
				recipientEmail: null,
				status: "failed",
				updatedAt: input.now,
			},
		});
		if (item.notificationId)
			await tx
				.update(notification)
				.set({ emailError: error, emailedAt: null, emailStatus: "failed" })
				.where(
					and(eq(notification.id, item.notificationId), eq(notification.emailStatus, "pending")),
				);
	});
	return shouldRetry ? "retry_scheduled" : "failed";
}
