import { and, asc, eq, inArray, lte, or, sql } from "drizzle-orm";
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
	readonly now: Date;
}

export async function claimEmailBatch(options: ClaimEmailBatchOptions) {
	return database.transaction(async (tx) => {
		const candidates = await tx
			.select({ id: emailOutbox.id })
			.from(emailOutbox)
			.where(
				or(
					and(
						eq(emailOutbox.status, "pending"),
						lte(emailOutbox.availableAt, options.now),
					),
					and(
						eq(emailOutbox.status, "processing"),
						lte(emailOutbox.leaseExpiresAt, options.now),
					),
				),
			)
			.orderBy(asc(emailOutbox.availableAt), asc(emailOutbox.createdAt))
			.limit(options.batchSize)
			.for("update", { skipLocked: true });
		const ids = candidates.map(({ id }) => id);
		if (ids.length === 0) return [];
		return tx
			.update(emailOutbox)
			.set({
				attemptCount: sql`${emailOutbox.attemptCount} + 1`,
				lastError: null,
				leaseExpiresAt: new Date(options.now.getTime() + options.leaseDurationMs),
				status: "processing",
				updatedAt: options.now,
			})
			.where(inArray(emailOutbox.id, ids))
			.returning();
	});
}

export type ClaimedEmail = Awaited<ReturnType<typeof claimEmailBatch>>[number];

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
		readonly id: string;
		readonly set: EmailOutboxStateUpdate;
	},
) {
	const [updated] = await tx
		.update(emailOutbox)
		.set(input.set)
		.where(and(eq(emailOutbox.id, input.id), eq(emailOutbox.status, "processing")))
		.returning({ id: emailOutbox.id });
	if (!updated) throw new Error(`Email outbox lease was lost before updating ${input.id}`);
}

export async function markEmailAccepted(
	item: ClaimedEmail,
	acceptance: MailAcceptance,
	now: Date,
): Promise<void> {
	await database.transaction(async (tx) => {
		await requireClaimedUpdate(tx, {
			id: item.id,
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
					and(
						eq(notification.id, item.notificationId),
						eq(notification.emailStatus, "pending"),
					),
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
				id: item.id,
				set: {
					availableAt: new Date(
						input.now.getTime() +
							retryDelayMilliseconds(
								item.attemptCount,
								input.retryJitter ?? Math.random(),
							),
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
			id: item.id,
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
					and(
						eq(notification.id, item.notificationId),
						eq(notification.emailStatus, "pending"),
					),
				);
	});
	return shouldRetry ? "retry_scheduled" : "failed";
}
