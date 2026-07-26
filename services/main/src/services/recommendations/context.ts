import { and, desc, eq, gte } from "drizzle-orm";
import type { ContentLanguage } from "@rezics/i18n";
import { OfficialRealmUnitIds } from "@rezics/slug";

import { database } from "../database";
import { ContentRatingValues, profilePreference, recommendationSnapshot } from "../database/schema";
import { RecommendationPolicy, RecommendationPolicyVersion } from "./policy";

export interface RecommendationViewer {
	profileId?: string;
	personalized: boolean;
	contentRatings: (typeof ContentRatingValues)[number][];
	preferredLanguages: ContentLanguage[];
	defaultScoreContextUnitId: string;
}

export function resolvePersonalization(
	storedPreference: boolean | undefined,
	requestOverride: boolean | undefined,
) {
	return (storedPreference ?? true) && (requestOverride ?? true);
}

export async function resolveRecommendationViewer(
	profileId: string | undefined,
	personalizedOverride?: boolean,
): Promise<RecommendationViewer> {
	if (!profileId)
		return {
			profileId: undefined,
			personalized: false,
			contentRatings: [],
			preferredLanguages: [],
			defaultScoreContextUnitId: OfficialRealmUnitIds.score,
		};
	const [preference] = await database
		.select({
			personalized: profilePreference.personalizedFeed,
			contentRatings: profilePreference.contentRatings,
			preferredLanguages: profilePreference.preferredLanguages,
			defaultScoreContextUnitId: profilePreference.defaultScoreContextUnitId,
		})
		.from(profilePreference)
		.where(eq(profilePreference.profileId, profileId))
		.limit(1);
	return {
		profileId,
		personalized: resolvePersonalization(preference?.personalized, personalizedOverride),
		contentRatings: preference?.contentRatings ?? [],
		preferredLanguages: preference?.preferredLanguages ?? [],
		defaultScoreContextUnitId:
			preference?.defaultScoreContextUnitId ?? OfficialRealmUnitIds.score,
	};
}

export interface RecommendationSnapshotContext {
	id: string;
	policyVersion: string;
	completedAt: Date;
}

export async function resolveRecommendationSnapshot(
	requestedId?: string | null,
): Promise<RecommendationSnapshotContext | null> {
	const staleBoundary = new Date(
		Date.now() - RecommendationPolicy.snapshotStaleHours * 3_600_000,
	);
	const [snapshot] = await database
		.select({
			id: recommendationSnapshot.id,
			policyVersion: recommendationSnapshot.policyVersion,
			completedAt: recommendationSnapshot.completedAt,
		})
		.from(recommendationSnapshot)
		.where(
			requestedId
				? and(
						eq(recommendationSnapshot.id, requestedId),
						eq(recommendationSnapshot.state, "ready"),
					)
				: and(
						eq(recommendationSnapshot.active, true),
						eq(recommendationSnapshot.state, "ready"),
						gte(recommendationSnapshot.completedAt, staleBoundary),
					),
		)
		.orderBy(desc(recommendationSnapshot.completedAt))
		.limit(1);
	if (!snapshot?.completedAt) return null;
	return {
		id: snapshot.id,
		policyVersion: snapshot.policyVersion,
		completedAt: snapshot.completedAt,
	};
}

export const fallbackRecommendationSnapshot = {
	id: null,
	policyVersion: RecommendationPolicyVersion,
} as const;
