import { describe, expect, test } from "bun:test";
import {
  bestScore,
  computeV1RankingScores,
  netScore,
  RANKING_FORMULA_VERSION,
  redditControversy,
  redditHot,
  wilsonLowerBound,
} from "./formulas";

describe("ranking formulas", () => {
  test("returns numeric default scores for empty signals", () => {
    const scores = computeV1RankingScores({
      unitId: "unit-1",
      rankKind: "content",
      scope: { kind: "global" },
    });

    expect(RANKING_FORMULA_VERSION).toBe("ranking-v1");
    expect(Number.isFinite(scores.bestScore)).toBe(true);
    expect(Number.isFinite(scores.hotScore)).toBe(true);
    expect(Number.isFinite(scores.topScore)).toBe(true);
    expect(Number.isFinite(scores.risingScore)).toBe(true);
    expect(Number.isFinite(scores.controversyScore)).toBe(true);
    expect(Number.isFinite(scores.trendingScore)).toBe(true);
    expect(Number.isFinite(scores.qualityScore)).toBe(true);
    expect(scores.topScore).toBe(0);
  });

  test("vote-only scores ignore non-vote reaction kinds", () => {
    const base = computeV1RankingScores({
      unitId: "unit-1",
      rankKind: "post",
      scope: { kind: "global" },
      createdAt: "2026-01-01T00:00:00.000Z",
      reactionCounts: { upvote: 4, downvote: 1 },
    });
    const noisy = computeV1RankingScores({
      unitId: "unit-1",
      rankKind: "post",
      scope: { kind: "global" },
      createdAt: "2026-01-01T00:00:00.000Z",
      reactionCounts: { upvote: 4, downvote: 1, bookmark: 99, laugh: 42 },
    });

    expect(noisy.bestScore).toBe(base.bestScore);
    expect(noisy.topScore).toBe(base.topScore);
    expect(noisy.risingScore).toBe(base.risingScore);
    expect(noisy.controversyScore).toBe(base.controversyScore);
  });

  test("quality score is Wilson lower bound and time-independent", () => {
    const oldScores = computeV1RankingScores({
      unitId: "unit-1",
      rankKind: "comment",
      scope: { kind: "parent", id: "post-1" },
      createdAt: "2020-01-01T00:00:00.000Z",
      reactionCounts: { upvote: 8, downvote: 2 },
    });
    const newScores = computeV1RankingScores({
      unitId: "unit-1",
      rankKind: "comment",
      scope: { kind: "parent", id: "post-1" },
      createdAt: "2026-01-01T00:00:00.000Z",
      reactionCounts: { upvote: 8, downvote: 2 },
    });

    expect(oldScores.qualityScore).toBe(wilsonLowerBound(8, 2));
    expect(newScores.qualityScore).toBe(oldScores.qualityScore);
  });

  test("reddit hot keeps the archived constants", () => {
    expect(redditHot(10, 5, "2005-12-08T07:46:43.000Z")).toBeCloseTo(
      Math.log10(5),
      12,
    );
    expect(redditHot(5, 10, "2005-12-08T07:46:43.000Z")).toBeCloseTo(
      -Math.log10(5),
      12,
    );
  });

  test("top score is net upvotes", () => {
    expect(netScore(7, 3)).toBe(4);
    expect(
      computeV1RankingScores({
        unitId: "unit-1",
        rankKind: "comment",
        scope: { kind: "parent", id: "post-1" },
        reactionCounts: { upvote: 7, downvote: 3 },
      }).topScore,
    ).toBe(4);
  });

  test("controversy score follows reddit edge cases", () => {
    expect(redditControversy(5, 0)).toBe(0);
    expect(redditControversy(0, 5)).toBe(0);
    expect(redditControversy(5, 5)).toBe(10);
    expect(redditControversy(9, 3)).toBeCloseTo(12 ** (1 / 3), 12);
  });

  test("best gives new promising comments a fading rising boost", () => {
    const oldHighQuality = bestScore({
      ups: 60,
      downs: 5,
      recentVotes: { upvote1h: 0, downvote1h: 0 },
    });
    const promisingNew = bestScore({
      ups: 6,
      downs: 0,
      recentVotes: { upvote1h: 6, downvote1h: 0 },
    });
    const sameMomentumWithManyVotes = bestScore({
      ups: 600,
      downs: 100,
      recentVotes: { upvote1h: 6, downvote1h: 0 },
    });
    const manyVotesNoMomentum = bestScore({
      ups: 600,
      downs: 100,
      recentVotes: { upvote1h: 0, downvote1h: 0 },
    });

    expect(promisingNew).toBeGreaterThan(oldHighQuality);
    expect(sameMomentumWithManyVotes - manyVotesNoMomentum).toBeLessThan(
      promisingNew - wilsonLowerBound(6, 0),
    );
  });
});
