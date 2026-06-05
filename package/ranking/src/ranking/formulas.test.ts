import { describe, expect, test } from "bun:test";
import { computeV1RankingScores, RANKING_FORMULA_VERSION } from "./formulas";

describe("ranking formulas", () => {
  test("returns numeric default scores for empty signals", () => {
    const scores = computeV1RankingScores({
      unitId: "unit-1",
      rankKind: "content",
      scope: { kind: "global" },
    });

    expect(RANKING_FORMULA_VERSION).toBe("ranking-v1");
    expect(Number.isFinite(scores.hotScore)).toBe(true);
    expect(Number.isFinite(scores.topScore)).toBe(true);
    expect(Number.isFinite(scores.trendingScore)).toBe(true);
    expect(Number.isFinite(scores.qualityScore)).toBe(true);
    expect(scores.topScore).toBe(0);
  });

  test("engagement increases top and quality scores", () => {
    const empty = computeV1RankingScores({
      unitId: "unit-1",
      rankKind: "post",
      scope: { kind: "global" },
    });
    const active = computeV1RankingScores({
      unitId: "unit-1",
      rankKind: "post",
      scope: { kind: "global" },
      createdAt: new Date().toISOString(),
      replyCount: 3,
      scoreTotal: 8,
      scoreCount: 2,
      reactionCounts: { upvote: 5 },
      bucketSignals: { views: 100, reads: 10 },
    });

    expect(active.topScore).toBeGreaterThan(empty.topScore);
    expect(active.qualityScore).toBeGreaterThan(empty.qualityScore);
  });
});
