import { and, count, eq, inArray, lte, sql } from "drizzle-orm";
import { getActiveObservability } from "@rezics/observability";

import { database, type DatabaseTransaction } from "../../database";
import {
	apiTokenRequestLease,
	apiTokenUsageBucket,
	type ApiTokenUsageBucketKind,
} from "../../database/schema";
import { ApiTokenRateLimitExceeded } from "../errors";
import { apiTokenOperationCostUnits } from "./operation";
import { resolveTokenOperationLimits } from "./policy-schema";
import type { ResolvedApiTokenPolicy } from "./policy-service";

const { logger } = getActiveObservability();

const GlobalScope = "*";
const RequestLeaseDurationMilliseconds = 2 * 60 * 1_000;

type UsageWindow = {
	kind: ApiTokenUsageBucketKind;
	scope: string;
	startedAt: Date;
	expiresAt: Date;
	amount: number;
	limit: number;
};

function startOfMinute(now: Date): Date {
	return new Date(Math.floor(now.getTime() / 60_000) * 60_000);
}

function startOfUtcDay(now: Date): Date {
	return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function retryAfterSeconds(expiresAt: Date, now: Date): number {
	return Math.max(1, Math.ceil((expiresAt.getTime() - now.getTime()) / 1_000));
}

async function consumeUsageWindow(
	tx: DatabaseTransaction,
	tokenId: string,
	window: UsageWindow,
	updatedAt: Date,
): Promise<void> {
	if (window.amount > window.limit)
		throw new ApiTokenRateLimitExceeded(retryAfterSeconds(window.expiresAt, updatedAt));
	const result = await tx.execute(sql`
		insert into ${apiTokenUsageBucket} (
			"token_id", "scope", "kind", "window_started_at", "used", "expires_at", "created_at", "updated_at"
		)
		values (
			${tokenId}, ${window.scope}, ${window.kind}, ${window.startedAt}, ${window.amount},
			${window.expiresAt}, ${updatedAt}, ${updatedAt}
		)
		on conflict ("token_id", "scope", "kind", "window_started_at") do update
		set
			"used" = ${apiTokenUsageBucket.used} + excluded."used",
			"updated_at" = excluded."updated_at",
			"expires_at" = excluded."expires_at"
		where ${apiTokenUsageBucket.used} + excluded."used" <= ${window.limit}
		returning "used"
	`);
	if (result.rowCount === 0)
		throw new ApiTokenRateLimitExceeded(retryAfterSeconds(window.expiresAt, updatedAt));
}

async function lockConcurrencyScopes(
	tx: DatabaseTransaction,
	tokenId: string,
	scopes: readonly string[],
) {
	for (const scope of [...scopes].sort()) {
		await tx.execute(
			sql`select pg_advisory_xact_lock(hashtextextended(${`api-token:${tokenId}:${scope}`}::text, 0))`,
		);
	}
}

async function acquireConcurrencyLease(
	tx: DatabaseTransaction,
	input: {
		tokenId: string;
		scope: string;
		limit: number;
		now: Date;
	},
): Promise<string> {
	const [usage] = await tx
		.select({ active: count(), firstExpiry: sql<Date>`min(${apiTokenRequestLease.expiresAt})` })
		.from(apiTokenRequestLease)
		.where(
			and(
				eq(apiTokenRequestLease.tokenId, input.tokenId),
				eq(apiTokenRequestLease.scope, input.scope),
			),
		);
	if ((usage?.active ?? 0) >= input.limit) {
		throw new ApiTokenRateLimitExceeded(
			retryAfterSeconds(
				usage?.firstExpiry ?? new Date(input.now.getTime() + 1_000),
				input.now,
			),
		);
	}

	const leaseId = crypto.randomUUID();
	await tx.insert(apiTokenRequestLease).values({
		id: leaseId,
		tokenId: input.tokenId,
		scope: input.scope,
		expiresAt: new Date(input.now.getTime() + RequestLeaseDurationMilliseconds),
		createdAt: input.now,
	});
	return leaseId;
}

export type ApiTokenLimitLease = {
	release(): Promise<void>;
};

export async function enforceApiTokenLimits(input: {
	tokenId: string;
	operationId: string;
	policy: ResolvedApiTokenPolicy;
	now?: Date;
}): Promise<ApiTokenLimitLease> {
	const now = input.now ?? new Date();
	const operationCost = apiTokenOperationCostUnits(input.operationId);
	const limits = resolveTokenOperationLimits(input.policy.configuration, input.operationId);
	const operationScope = limits.operation ? input.operationId : undefined;
	const concurrencyScopes = operationScope ? [GlobalScope, operationScope] : [GlobalScope];
	const minuteStartedAt = startOfMinute(now);
	const minuteExpiresAt = new Date(minuteStartedAt.getTime() + 60_000);
	const dayStartedAt = startOfUtcDay(now);
	const dayExpiresAt = new Date(dayStartedAt.getTime() + 24 * 60 * 60 * 1_000);

	const leaseIds = await database.transaction(async (tx) => {
		await lockConcurrencyScopes(tx, input.tokenId, concurrencyScopes);
		await tx
			.delete(apiTokenRequestLease)
			.where(
				and(
					eq(apiTokenRequestLease.tokenId, input.tokenId),
					inArray(apiTokenRequestLease.scope, concurrencyScopes),
					lte(apiTokenRequestLease.expiresAt, now),
				),
			);
		await tx
			.delete(apiTokenUsageBucket)
			.where(
				and(
					eq(apiTokenUsageBucket.tokenId, input.tokenId),
					lte(apiTokenUsageBucket.expiresAt, now),
				),
			);

		await consumeUsageWindow(
			tx,
			input.tokenId,
			{
				kind: "minute_requests",
				scope: GlobalScope,
				startedAt: minuteStartedAt,
				expiresAt: minuteExpiresAt,
				amount: 1,
				limit: limits.global.requestsPerMinute,
			},
			now,
		);
		if (operationScope && limits.operation)
			await consumeUsageWindow(
				tx,
				input.tokenId,
				{
					kind: "minute_requests",
					scope: operationScope,
					startedAt: minuteStartedAt,
					expiresAt: minuteExpiresAt,
					amount: 1,
					limit: limits.operation.requestsPerMinute,
				},
				now,
			);
		await consumeUsageWindow(
			tx,
			input.tokenId,
			{
				kind: "daily_cost",
				scope: GlobalScope,
				startedAt: dayStartedAt,
				expiresAt: dayExpiresAt,
				amount: operationCost,
				limit: limits.global.dailyCostUnits,
			},
			now,
		);
		if (operationScope && limits.operation)
			await consumeUsageWindow(
				tx,
				input.tokenId,
				{
					kind: "daily_cost",
					scope: operationScope,
					startedAt: dayStartedAt,
					expiresAt: dayExpiresAt,
					amount: operationCost,
					limit: limits.operation.dailyCostUnits,
				},
				now,
			);

		const ids = [
			await acquireConcurrencyLease(tx, {
				tokenId: input.tokenId,
				scope: GlobalScope,
				limit: limits.global.maxConcurrentRequests,
				now,
			}),
		];
		if (operationScope && limits.operation)
			ids.push(
				await acquireConcurrencyLease(tx, {
					tokenId: input.tokenId,
					scope: operationScope,
					limit: limits.operation.maxConcurrentRequests,
					now,
				}),
			);
		return ids;
	});

	let released = false;
	return {
		async release() {
			if (released) return;
			released = true;
			try {
				await database
					.delete(apiTokenRequestLease)
					.where(inArray(apiTokenRequestLease.id, leaseIds));
			} catch (error) {
				logger.error("Failed to release API token concurrency lease", {
					eventName: "api_token.limit_lease.release_failed",
					errorCode: "ApiTokenLimitLeaseReleaseFailed",
					error,
					attributes: { tokenId: input.tokenId, operationId: input.operationId },
				});
			}
		},
	};
}
