import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { recommendationUnitStat } from "../database/schema";
import {
	isMaterializedRecommendationSort,
	recommendationObjectiveExpression,
	recommendationObjectiveOrder,
	recommendationObjectiveScoreColumn,
	type RecommendationObjectiveSqlSource,
} from "./sql-ranking";

const dialect = new PgDialect();

const FixtureObjectiveSource = {
	createdAt: sql<Date>`fixture.unit_created_at`,
	impressions: sql<bigint>`fixture.impressions`,
	opens: sql<bigint>`fixture.opens`,
	dwell30s: sql<bigint>`fixture.dwell30s`,
	upvotes: sql<bigint>`fixture.upvotes`,
	downvotes: sql<bigint>`fixture.downvotes`,
	replies: sql<bigint>`fixture.replies`,
	favorites: sql<bigint>`fixture.favorites`,
	shares: sql<bigint>`fixture.shares`,
	highScores: sql<bigint>`fixture.high_scores`,
	activeProgress: sql<bigint>`fixture.active_progress`,
	completions: sql<bigint>`fixture.completions`,
	negativeProgress: sql<bigint>`fixture.negative_progress`,
	engagement6h: sql<number>`fixture.engagement6h`,
	engagement24h: sql<number>`fixture.engagement24h`,
	engagement7d: sql<number>`fixture.engagement7d`,
} satisfies RecommendationObjectiveSqlSource;

describe("materialized recommendation objectives", () => {
	it("maps every non-recency sort to its persisted score", () => {
		expect(recommendationObjectiveScoreColumn("best")).toBe(recommendationUnitStat.bestScore);
		expect(recommendationObjectiveScoreColumn("hot")).toBe(recommendationUnitStat.hotScore);
		expect(recommendationObjectiveScoreColumn("top")).toBe(recommendationUnitStat.topScore);
		expect(recommendationObjectiveScoreColumn("rising")).toBe(
			recommendationUnitStat.risingScore,
		);
		expect(isMaterializedRecommendationSort("new")).toBe(false);
	});

	it("keeps the online ordering identical to the persisted index ordering", () => {
		const order = recommendationObjectiveOrder("best").map(
			(expression) => dialect.sqlToQuery(expression).sql,
		);

		expect(order).toEqual([
			'"recommendation_unit_stat"."best_score" desc nulls last',
			'"recommendation_unit_stat"."unit_created_at" desc nulls last',
			'"recommendation_unit_stat"."unit_id" desc nulls last',
		]);
	});

	it("reuses the canonical SQL formula against snapshot-build fields", () => {
		const query = dialect.sqlToQuery(
			recommendationObjectiveExpression(
				"best",
				new Date("2026-08-06T00:00:00.000Z"),
				FixtureObjectiveSource,
			),
		);

		expect(query.sql).toContain("fixture.opens");
		expect(query.sql).toContain("fixture.impressions");
		expect(query.sql).not.toContain('"recommendation_unit_stat"');
	});
});
