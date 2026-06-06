import { describe, expect, test } from "bun:test";
import {
  dedupeFeedCandidatesByPostUnitId,
  type FeedRecommendationReason,
  feedCandidateHref,
  feedContextForReason,
} from "./feed-context";

describe("feed context routing", () => {
  test("uses direct context for global recommendation reasons", () => {
    const directReasons: FeedRecommendationReason[] = [
      "author-follow",
      "target-affinity",
      "work-affinity",
      "profile-activity",
      "search",
      "global-post-rank",
    ];

    for (const reason of directReasons) {
      expect(feedContextForReason(reason, "realm-1")).toEqual({
        kind: "direct",
      });
    }
  });

  test("uses realm context for realm-derived recommendation reasons", () => {
    const realmReasons: FeedRecommendationReason[] = [
      "realm-membership",
      "realm-feed-activity",
      "realm-comment-activity",
      "realm-tags",
      "realm-moderation",
      "realm-reaction-activity",
    ];

    for (const reason of realmReasons) {
      expect(feedContextForReason(reason, "realm-1")).toEqual({
        kind: "realm",
        realmUnitId: "realm-1",
      });
    }
  });

  test("routes realm context through slug when available", () => {
    expect(
      feedCandidateHref({
        postUnitId: "post-1",
        context: {
          kind: "realm",
          realmUnitId: "realm-1",
          realmSlug: "fiction",
        },
      }),
    ).toBe("/r/fiction/post/post-1");
  });

  test("deduplicates by postUnitId using viewer relation, score, then recency", () => {
    const result = dedupeFeedCandidatesByPostUnitId([
      {
        postUnitId: "post-1",
        context: { kind: "realm", realmUnitId: "realm-1" },
        viewerRelationshipScore: 1,
        recommendationScore: 10,
        recentActivityAt: "2026-01-01T00:00:00.000Z",
      },
      {
        postUnitId: "post-1",
        context: { kind: "direct" },
        viewerRelationshipScore: 2,
        recommendationScore: 1,
        recentActivityAt: "2026-01-01T00:00:01.000Z",
      },
      {
        postUnitId: "post-2",
        context: { kind: "realm", realmUnitId: "realm-2" },
        viewerRelationshipScore: 0,
        recommendationScore: 5,
        recentActivityAt: "2026-01-01T00:00:00.000Z",
      },
    ]);

    expect(result).toEqual([
      {
        postUnitId: "post-1",
        context: { kind: "direct" },
        viewerRelationshipScore: 2,
        recommendationScore: 1,
        recentActivityAt: "2026-01-01T00:00:01.000Z",
      },
      {
        postUnitId: "post-2",
        context: { kind: "realm", realmUnitId: "realm-2" },
        viewerRelationshipScore: 0,
        recommendationScore: 5,
        recentActivityAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
  });
});
