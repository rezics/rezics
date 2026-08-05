import { sql } from "drizzle-orm";

import { database } from "../database";
import { toSafeInteger } from "../database/integer";
import type { CountResult } from "./contract";

export const EstimateTargetValues = [
	"unit",
	"unit-localization",
	"public-discoverable-unit",
] as const;
export type EstimateTarget = (typeof EstimateTargetValues)[number];

const RelationByTarget = {
	unit: "public.unit",
	"unit-localization": "public.unit_localization",
	"public-discoverable-unit": "public.unit_public_discoverable_idx",
} as const satisfies Record<EstimateTarget, string>;

export class CountEstimateUnavailable extends Error {
	override readonly name = "CountEstimateUnavailable";
}

/**
 * Reads an allow-listed whole-relation or fixed-partial-index estimate without foreground
 * maintenance or metrics-ledger writes.
 */
export async function estimateCount(target: EstimateTarget): Promise<CountResult> {
	const relation = RelationByTarget[target];
	return database.transaction(async (tx) => {
		await tx.execute(sql`set transaction read only`);
		await tx.execute(sql`select set_config('approx_count.sample_rate', '0', true)`);
		const result = await tx.execute<{
			estimatedRows: string;
			statsAt: Date | string | null;
			modsSinceAnalyze: string;
		}>(sql`
			select estimated_rows::text as "estimatedRows",
				stats_at as "statsAt",
				mods_since_analyze::text as "modsSinceAnalyze"
			from approx_count.approx_count_info(${relation}::regclass, null, false)
		`);
		const row = result.rows[0];
		if (!row || row.statsAt === null)
			throw new CountEstimateUnavailable(`${target} has not been analyzed`);
		const asOf = new Date(row.statsAt).toISOString();
		return {
			kind: "estimate",
			value: toSafeInteger(row.estimatedRows, `${target} estimated rows`),
			asOf,
			modifiedSinceAnalyze: toSafeInteger(
				row.modsSinceAnalyze,
				`${target} modifications since analyze`,
			),
		};
	});
}
