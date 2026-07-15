import { sql } from "drizzle-orm";

import { recommendationUnitStat, unit } from "../database/schema";
import type { RecommendationSort } from "./policy";

export function recommendationPositiveExpression() {
	return sql<number>`(
		coalesce(${recommendationUnitStat.opens}, 0)
		+ coalesce(${recommendationUnitStat.dwell30s}, 0) * 2
		+ coalesce(${recommendationUnitStat.upvotes}, 0) * 3
		+ coalesce(${recommendationUnitStat.replies}, 0) * 4
		+ coalesce(${recommendationUnitStat.favorites}, 0) * 5
		+ coalesce(${recommendationUnitStat.shares}, 0) * 4
		+ coalesce(${recommendationUnitStat.highScores}, 0) * 5
		+ coalesce(${recommendationUnitStat.activeProgress}, 0) * 3
		+ coalesce(${recommendationUnitStat.completions}, 0) * 5
	)`;
}

export function recommendationNegativeExpression() {
	return sql<number>`(
		coalesce(${recommendationUnitStat.downvotes}, 0) * 4
		+ coalesce(${recommendationUnitStat.negativeProgress}, 0) * 4
	)`;
}

export function recommendationObjectiveExpression(sort: RecommendationSort, asOf: Date) {
	const positive = recommendationPositiveExpression();
	const negative = recommendationNegativeExpression();
	if (sort === "new") return sql<number>`extract(epoch from ${unit.createdAt})`;
	if (sort === "top") return sql<number>`ln(1 + greatest(0, ${positive} - ${negative}))`;
	if (sort === "hot")
		return sql<number>`(
			coalesce(${recommendationUnitStat.engagement24h}, 0) + ${positive} * 0.05 + 1
		) / power(
			greatest(0, extract(epoch from (${asOf}::timestamptz - ${unit.createdAt})) / 3600.0) + 2,
			0.6
		)`;
	if (sort === "rising")
		return sql<number>`(coalesce(${recommendationUnitStat.engagement6h}, 0) + 1) / (coalesce(${recommendationUnitStat.engagement7d}, 0) / 28.0 + 2)`;
	return sql<number>`(${positive} + 5)::double precision / (
		greatest(coalesce(${recommendationUnitStat.impressions}, 0), ${positive} + ${negative})
		+ 10 + ${negative} * 2
	)`;
}
