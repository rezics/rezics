export type FeedItemContext =
  | { kind: "direct" }
  | { kind: "realm"; realmUnitId: string; realmSlug?: string | null };

export type FeedRecommendationReason =
  | "author-follow"
  | "target-affinity"
  | "work-affinity"
  | "profile-activity"
  | "search"
  | "global-post-rank"
  | "realm-membership"
  | "realm-feed-activity"
  | "realm-comment-activity"
  | "realm-tags"
  | "realm-moderation"
  | "realm-reaction-activity";

export type FeedCandidate = {
  postUnitId: string;
  context: FeedItemContext;
  viewerRelationshipScore?: number;
  recommendationScore?: number;
  recentActivityAt?: string | null;
};

export function feedCandidateHref(candidate: FeedCandidate): string {
  if (candidate.context.kind === "direct") {
    return `/post/${candidate.postUnitId}`;
  }
  if (candidate.context.realmSlug) {
    return `/r/${candidate.context.realmSlug}/post/${candidate.postUnitId}`;
  }
  return `/realm/${candidate.context.realmUnitId}/post/${candidate.postUnitId}`;
}

export function feedContextForReason(
  reason: FeedRecommendationReason,
  realmUnitId?: string | null,
): FeedItemContext {
  switch (reason) {
    case "realm-membership":
    case "realm-feed-activity":
    case "realm-comment-activity":
    case "realm-tags":
    case "realm-moderation":
    case "realm-reaction-activity":
      return realmUnitId ? { kind: "realm", realmUnitId } : { kind: "direct" };
    default:
      return { kind: "direct" };
  }
}

export function dedupeFeedCandidatesByPostUnitId(
  candidates: readonly FeedCandidate[],
): FeedCandidate[] {
  const bestByPostUnitId = new Map<string, FeedCandidate>();
  for (const candidate of candidates) {
    const current = bestByPostUnitId.get(candidate.postUnitId);
    if (!current || compareCandidateContext(candidate, current) > 0) {
      bestByPostUnitId.set(candidate.postUnitId, candidate);
    }
  }
  return Array.from(bestByPostUnitId.values());
}

function compareCandidateContext(a: FeedCandidate, b: FeedCandidate): number {
  const viewerDelta =
    (a.viewerRelationshipScore ?? 0) - (b.viewerRelationshipScore ?? 0);
  if (viewerDelta !== 0) return viewerDelta;

  const scoreDelta =
    (a.recommendationScore ?? 0) - (b.recommendationScore ?? 0);
  if (scoreDelta !== 0) return scoreDelta;

  return (
    Date.parse(a.recentActivityAt ?? "") - Date.parse(b.recentActivityAt ?? "")
  );
}
