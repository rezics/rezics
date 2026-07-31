import { lt } from "drizzle-orm";

import { database } from "../../database";
import {
	apiQuotaDailyUsage,
	apiQuotaRateState,
	apiQuotaRequestLease,
	apiTokenCreationReservation,
} from "../../database/schema";

export const ApiQuotaRateStateRetentionMilliseconds = 7 * 24 * 60 * 60 * 1_000;
export const ApiQuotaDailyUsageRetentionDays = 35;

export function apiQuotaCleanupCutoffs(now: Date): {
	readonly rateState: Date;
	readonly dailyUsage: string;
} {
	if (Number.isNaN(now.getTime())) throw new TypeError("API quota cleanup time must be valid");
	const dailyUsage = new Date(
		Date.UTC(
			now.getUTCFullYear(),
			now.getUTCMonth(),
			now.getUTCDate() - ApiQuotaDailyUsageRetentionDays,
		),
	)
		.toISOString()
		.slice(0, 10);
	return {
		rateState: new Date(now.getTime() - ApiQuotaRateStateRetentionMilliseconds),
		dailyUsage,
	};
}

export async function cleanupApiQuotaState(now = new Date()): Promise<number> {
	const cutoffs = apiQuotaCleanupCutoffs(now);
	return database.transaction(async (tx) => {
		const leases = await tx
			.delete(apiQuotaRequestLease)
			.where(lt(apiQuotaRequestLease.expiresAt, now))
			.returning({ id: apiQuotaRequestLease.id });
		const reservations = await tx
			.delete(apiTokenCreationReservation)
			.where(lt(apiTokenCreationReservation.expiresAt, now))
			.returning({ id: apiTokenCreationReservation.id });
		const rateStates = await tx
			.delete(apiQuotaRateState)
			.where(lt(apiQuotaRateState.updatedAt, cutoffs.rateState))
			.returning({ id: apiQuotaRateState.id });
		const dailyUsages = await tx
			.delete(apiQuotaDailyUsage)
			.where(lt(apiQuotaDailyUsage.usageDate, cutoffs.dailyUsage))
			.returning({ id: apiQuotaDailyUsage.id });
		return leases.length + reservations.length + rateStates.length + dailyUsages.length;
	});
}
