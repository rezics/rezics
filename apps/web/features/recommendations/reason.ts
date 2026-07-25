import type { Translation } from "@rezics/i18n";
import type { PostApiFeedQueryStatus200ItemsRecommendationReason } from "@rezics/openapi-tanstack-query";

export function recommendationReasonLabel(
	reason: PostApiFeedQueryStatus200ItemsRecommendationReason | null | undefined,
	feed: Translation["feed"],
) {
	if (reason === "followed_unit") return feed.reason.followedUnit;
	if (reason === "followed_realm") return feed.reason.followedRealm;
	if (reason === "based_on_activity") return feed.reason.basedOnActivity;
	if (reason === "related_subject") return feed.reason.relatedSubject;
	if (reason === "popular_now") return feed.reason.popularNow;
	if (reason === "new_and_relevant") return feed.reason.newAndRelevant;
	return undefined;
}
