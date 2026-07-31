import { and, count, eq, lte, min, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { getActiveObservability } from "@rezics/observability";

import { database, type DatabaseTransaction } from "../../database";
import { apiQuotaDailyUsage, apiQuotaRateState, apiQuotaRequestLease } from "../../database/schema";
import { ApiQuotaExceeded, type ApiQuotaExceededDetails } from "../errors";
import type { ResolvedApiQuotaOperation } from "./operation";
import {
	resolveApiQuotaLimits,
	resolveApiTokenQuotaLimits,
	type ApiQuotaLimitOverride,
	type ApiQuotaLimits,
	type ApiTokenQuotaOverride,
} from "./policy-schema";
import type { ResolvedApiAccountQuotaPolicy } from "./policy-service";

const { logger } = getActiveObservability();

export const ApiQuotaGlobalScope = "*";
export const ApiQuotaRateUnitScale = 60_000;
export const ApiQuotaRequestLeaseDurationMilliseconds = 2 * 60 * 1_000;

type ApiQuotaSubject = { kind: "account"; id: string } | { kind: "token"; id: string };

export type ApiQuotaConstraint = {
	subject: ApiQuotaSubject;
	scope: string;
	limits: ApiQuotaLimits | ApiQuotaLimitOverride;
};

export type ApiQuotaRateStateValue = {
	availableRateUnits: number;
	refilledAt: Date;
};

export type RefilledApiQuotaRateState = ApiQuotaRateStateValue & {
	capacityRateUnits: number;
};

export function refillApiQuotaRateState(
	state: ApiQuotaRateStateValue | undefined,
	requestRate: ApiQuotaLimits["requestRate"],
	now: Date,
): RefilledApiQuotaRateState {
	const capacityRateUnits = requestRate.burstCapacity * ApiQuotaRateUnitScale;
	if (!state)
		return {
			availableRateUnits: capacityRateUnits,
			capacityRateUnits,
			refilledAt: now,
		};
	const elapsedMilliseconds = Math.max(0, now.getTime() - state.refilledAt.getTime());
	return {
		availableRateUnits: Math.min(
			capacityRateUnits,
			state.availableRateUnits + elapsedMilliseconds * requestRate.requestsPerMinute,
		),
		capacityRateUnits,
		refilledAt: now,
	};
}

export function buildApiQuotaConstraints(input: {
	accountUserId: string;
	tokenId: string;
	operation: ResolvedApiQuotaOperation;
	accountPolicy: ResolvedApiAccountQuotaPolicy;
	tokenOverride?: ApiTokenQuotaOverride;
}): ApiQuotaConstraint[] {
	const account = resolveApiQuotaLimits(input.accountPolicy.configuration, input.operation.scope);
	const token = resolveApiTokenQuotaLimits(input.tokenOverride, input.operation.scope);
	const operationScope = input.operation.scope;
	return [
		{
			subject: { kind: "account", id: input.accountUserId },
			scope: ApiQuotaGlobalScope,
			limits: account.global,
		},
		...(operationScope && account.operation
			? [
					{
						subject: { kind: "account" as const, id: input.accountUserId },
						scope: operationScope,
						limits: account.operation,
					},
				]
			: []),
		...(token.global
			? [
					{
						subject: { kind: "token" as const, id: input.tokenId },
						scope: ApiQuotaGlobalScope,
						limits: token.global,
					},
				]
			: []),
		...(operationScope && token.operation
			? [
					{
						subject: { kind: "token" as const, id: input.tokenId },
						scope: operationScope,
						limits: token.operation,
					},
				]
			: []),
	];
}

function subjectPredicate(
	subject: ApiQuotaSubject,
	columns: { accountUserId: AnyPgColumn; tokenId: AnyPgColumn },
) {
	return subject.kind === "account"
		? eq(columns.accountUserId, subject.id)
		: eq(columns.tokenId, subject.id);
}

function subjectValues(subject: ApiQuotaSubject) {
	return subject.kind === "account"
		? { accountUserId: subject.id, tokenId: null }
		: { accountUserId: null, tokenId: subject.id };
}

function retryAfterSeconds(retryAt: Date, now: Date): number {
	return Math.max(1, Math.ceil((retryAt.getTime() - now.getTime()) / 1_000));
}

function quotaExceeded(
	constraint: ApiQuotaConstraint,
	dimension: ApiQuotaExceededDetails["dimension"],
	limit: number,
	retryAfter: number,
) {
	return new ApiQuotaExceeded(retryAfter, {
		dimension,
		subject: constraint.subject.kind,
		scope: constraint.scope,
		limit,
	});
}

async function lockConstraints(
	tx: DatabaseTransaction,
	constraints: readonly ApiQuotaConstraint[],
): Promise<void> {
	const keys = constraints
		.map(
			(constraint) =>
				`api-quota:${constraint.subject.kind}:${constraint.subject.id}:${constraint.scope}`,
		)
		.sort();
	for (const key of keys)
		await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${key}::text, 0))`);
}

async function consumeRequestRate(
	tx: DatabaseTransaction,
	constraint: ApiQuotaConstraint,
	now: Date,
): Promise<void> {
	const requestRate = constraint.limits.requestRate;
	if (!requestRate) return;
	const [stored] = await tx
		.select({
			id: apiQuotaRateState.id,
			availableRateUnits: apiQuotaRateState.availableRateUnits,
			refilledAt: apiQuotaRateState.refilledAt,
		})
		.from(apiQuotaRateState)
		.where(
			and(
				subjectPredicate(constraint.subject, apiQuotaRateState),
				eq(apiQuotaRateState.scope, constraint.scope),
			),
		)
		.limit(1);
	const refilled = refillApiQuotaRateState(stored, requestRate, now);
	if (refilled.availableRateUnits < ApiQuotaRateUnitScale) {
		const missingUnits = ApiQuotaRateUnitScale - refilled.availableRateUnits;
		const retryMilliseconds = Math.ceil(missingUnits / requestRate.requestsPerMinute);
		throw quotaExceeded(
			constraint,
			"request_rate",
			requestRate.requestsPerMinute,
			Math.max(1, Math.ceil(retryMilliseconds / 1_000)),
		);
	}
	const availableRateUnits = refilled.availableRateUnits - ApiQuotaRateUnitScale;
	if (stored) {
		await tx
			.update(apiQuotaRateState)
			.set({ availableRateUnits, refilledAt: now })
			.where(eq(apiQuotaRateState.id, stored.id));
		return;
	}
	await tx.insert(apiQuotaRateState).values({
		...subjectValues(constraint.subject),
		scope: constraint.scope,
		availableRateUnits,
		refilledAt: now,
		createdAt: now,
		updatedAt: now,
	});
}

function utcDate(now: Date): string {
	return now.toISOString().slice(0, 10);
}

function startOfNextUtcDay(now: Date): Date {
	return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}

async function consumeDailyCost(
	tx: DatabaseTransaction,
	constraint: ApiQuotaConstraint,
	costUnits: number,
	now: Date,
): Promise<void> {
	const limit = constraint.limits.dailyCostUnits;
	if (limit === undefined) return;
	const usageDate = utcDate(now);
	const [stored] = await tx
		.select({ id: apiQuotaDailyUsage.id, usedCostUnits: apiQuotaDailyUsage.usedCostUnits })
		.from(apiQuotaDailyUsage)
		.where(
			and(
				subjectPredicate(constraint.subject, apiQuotaDailyUsage),
				eq(apiQuotaDailyUsage.scope, constraint.scope),
				eq(apiQuotaDailyUsage.usageDate, usageDate),
			),
		)
		.limit(1);
	const usedCostUnits = (stored?.usedCostUnits ?? 0) + costUnits;
	if (usedCostUnits > limit)
		throw quotaExceeded(
			constraint,
			"daily_cost",
			limit,
			retryAfterSeconds(startOfNextUtcDay(now), now),
		);
	if (stored) {
		await tx
			.update(apiQuotaDailyUsage)
			.set({ usedCostUnits })
			.where(eq(apiQuotaDailyUsage.id, stored.id));
		return;
	}
	await tx.insert(apiQuotaDailyUsage).values({
		...subjectValues(constraint.subject),
		scope: constraint.scope,
		usageDate,
		usedCostUnits,
		createdAt: now,
		updatedAt: now,
	});
}

async function acquireConcurrencyLease(
	tx: DatabaseTransaction,
	constraint: ApiQuotaConstraint,
	requestId: string,
	now: Date,
): Promise<void> {
	const limit = constraint.limits.maxConcurrentRequests;
	if (limit === undefined) return;
	await tx
		.delete(apiQuotaRequestLease)
		.where(
			and(
				subjectPredicate(constraint.subject, apiQuotaRequestLease),
				eq(apiQuotaRequestLease.scope, constraint.scope),
				lte(apiQuotaRequestLease.expiresAt, now),
			),
		);
	const [usage] = await tx
		.select({
			active: count(),
			firstExpiry: min(apiQuotaRequestLease.expiresAt),
		})
		.from(apiQuotaRequestLease)
		.where(
			and(
				subjectPredicate(constraint.subject, apiQuotaRequestLease),
				eq(apiQuotaRequestLease.scope, constraint.scope),
			),
		);
	if ((usage?.active ?? 0) >= limit)
		throw quotaExceeded(
			constraint,
			"concurrency",
			limit,
			retryAfterSeconds(usage?.firstExpiry ?? new Date(now.getTime() + 1_000), now),
		);
	await tx.insert(apiQuotaRequestLease).values({
		...subjectValues(constraint.subject),
		requestId,
		scope: constraint.scope,
		expiresAt: new Date(now.getTime() + ApiQuotaRequestLeaseDurationMilliseconds),
		createdAt: now,
	});
}

export type ApiQuotaLease = {
	release(): Promise<void>;
};

export async function enforceApiQuota(input: {
	accountUserId: string;
	tokenId: string;
	operation: ResolvedApiQuotaOperation;
	accountPolicy: ResolvedApiAccountQuotaPolicy;
	tokenOverride?: ApiTokenQuotaOverride;
	now?: Date;
}): Promise<ApiQuotaLease> {
	const now = input.now ?? new Date();
	const constraints = buildApiQuotaConstraints(input);
	const requestId = crypto.randomUUID();
	await database.transaction(async (tx) => {
		await lockConstraints(tx, constraints);
		for (const constraint of constraints) {
			await consumeRequestRate(tx, constraint, now);
			await consumeDailyCost(tx, constraint, input.operation.costUnits, now);
			await acquireConcurrencyLease(tx, constraint, requestId, now);
		}
	});

	let released = false;
	return {
		async release() {
			if (released) return;
			released = true;
			try {
				await database
					.delete(apiQuotaRequestLease)
					.where(eq(apiQuotaRequestLease.requestId, requestId));
			} catch (error) {
				logger.error("Failed to release API quota concurrency leases", {
					eventName: "api_quota.lease.release_failed",
					errorCode: "ApiQuotaLeaseReleaseFailed",
					error,
					attributes: {
						accountUserId: input.accountUserId,
						tokenId: input.tokenId,
						operationScope: input.operation.scope ?? ApiQuotaGlobalScope,
						requestId,
					},
				});
			}
		},
	};
}
