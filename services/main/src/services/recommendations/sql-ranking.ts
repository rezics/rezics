import { sql, type SQLWrapper } from "drizzle-orm";

import { recommendationUnitStat, unit } from "../database/schema";
import type { RecommendationSort } from "./policy";

export interface RecommendationObjectiveSqlSource {
	readonly createdAt: SQLWrapper;
	readonly impressions: SQLWrapper;
	readonly opens: SQLWrapper;
	readonly dwell30s: SQLWrapper;
	readonly upvotes: SQLWrapper;
	readonly downvotes: SQLWrapper;
	readonly replies: SQLWrapper;
	readonly favorites: SQLWrapper;
	readonly shares: SQLWrapper;
	readonly highScores: SQLWrapper;
	readonly activeProgress: SQLWrapper;
	readonly completions: SQLWrapper;
	readonly negativeProgress: SQLWrapper;
	readonly engagement6h: SQLWrapper;
	readonly engagement24h: SQLWrapper;
	readonly engagement7d: SQLWrapper;
}

const DefaultRecommendationObjectiveSqlSource = {
	createdAt: unit.createdAt,
	impressions: recommendationUnitStat.impressions,
	opens: recommendationUnitStat.opens,
	dwell30s: recommendationUnitStat.dwell30s,
	upvotes: recommendationUnitStat.upvotes,
	downvotes: recommendationUnitStat.downvotes,
	replies: recommendationUnitStat.replies,
	favorites: recommendationUnitStat.favorites,
	shares: recommendationUnitStat.shares,
	highScores: recommendationUnitStat.highScores,
	activeProgress: recommendationUnitStat.activeProgress,
	completions: recommendationUnitStat.completions,
	negativeProgress: recommendationUnitStat.negativeProgress,
	engagement6h: recommendationUnitStat.engagement6h,
	engagement24h: recommendationUnitStat.engagement24h,
	engagement7d: recommendationUnitStat.engagement7d,
} satisfies RecommendationObjectiveSqlSource;

export type MaterializedRecommendationSort = Exclude<RecommendationSort, "new">;

export function isMaterializedRecommendationSort(
	sort: RecommendationSort,
): sort is MaterializedRecommendationSort {
	return sort !== "new";
}

export function recommendationObjectiveScoreColumn(sort: MaterializedRecommendationSort) {
	if (sort === "best") return recommendationUnitStat.bestScore;
	if (sort === "hot") return recommendationUnitStat.hotScore;
	if (sort === "top") return recommendationUnitStat.topScore;
	return recommendationUnitStat.risingScore;
}

/**
 * Matches the persisted objective indexes exactly so PostgreSQL can stop after the bounded limit.
 */
export function recommendationObjectiveOrder(sort: MaterializedRecommendationSort) {
	const score = recommendationObjectiveScoreColumn(sort);
	return [
		sql`${score} desc nulls last`,
		sql`${recommendationUnitStat.unitCreatedAt} desc nulls last`,
		sql`${recommendationUnitStat.unitId} desc nulls last`,
	] as const;
}

export function recommendationPositiveExpression(
	source: RecommendationObjectiveSqlSource = DefaultRecommendationObjectiveSqlSource,
) {
	return sql<number>`(
		coalesce(${source.opens}, 0)
		+ coalesce(${source.dwell30s}, 0) * 2
		+ coalesce(${source.upvotes}, 0) * 3
		+ coalesce(${source.replies}, 0) * 4
		+ coalesce(${source.favorites}, 0) * 5
		+ coalesce(${source.shares}, 0) * 4
		+ coalesce(${source.highScores}, 0) * 5
		+ coalesce(${source.activeProgress}, 0) * 3
		+ coalesce(${source.completions}, 0) * 5
	)`;
}

export function recommendationNegativeExpression(
	source: RecommendationObjectiveSqlSource = DefaultRecommendationObjectiveSqlSource,
) {
	return sql<number>`(
		coalesce(${source.downvotes}, 0) * 4
		+ coalesce(${source.negativeProgress}, 0) * 4
	)`;
}

export function recommendationObjectiveExpression(
	sort: RecommendationSort,
	asOf: Date,
	source: RecommendationObjectiveSqlSource = DefaultRecommendationObjectiveSqlSource,
) {
	const positive = recommendationPositiveExpression(source);
	const negative = recommendationNegativeExpression(source);
	if (sort === "new")
		return sql<number>`extract(epoch from ${source.createdAt})::double precision`;
	if (sort === "top") return sql<number>`ln(1 + greatest(0, ${positive} - ${negative}))`;
	if (sort === "hot")
		return sql<number>`(
			coalesce(${source.engagement24h}, 0) + ${positive} * 0.05 + 1
		) / power(
			greatest(0, extract(epoch from (${asOf}::timestamptz - ${source.createdAt})) / 3600.0) + 2,
			0.6
		)`;
	if (sort === "rising")
		return sql<number>`(coalesce(${source.engagement6h}, 0) + 1) / (coalesce(${source.engagement7d}, 0) / 28.0 + 2)`;
	return sql<number>`(${positive} + 5)::double precision / (
		greatest(coalesce(${source.impressions}, 0), ${positive} + ${negative})
		+ 10 + ${negative} * 2
	)`;
}
