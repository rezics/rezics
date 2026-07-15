import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "../config";

export interface RecommendationTrackingFields {
	requestId: string;
	surface: string;
	position: number;
	policyVersion: string;
}

export type SignedRecommendationTracking<T extends RecommendationTrackingFields> = T & {
	signature: string;
};

function trackingDigest(targetUnitId: string, tracking: RecommendationTrackingFields) {
	return createHmac("sha256", env.BETTER_AUTH_SECRET)
		.update("rezics:recommendation-tracking:v1\0")
		.update(
			JSON.stringify([
				targetUnitId,
				tracking.requestId,
				tracking.surface,
				tracking.position,
				tracking.policyVersion,
			]),
		)
		.digest();
}

export function createRecommendationTracking<const T extends RecommendationTrackingFields>(
	targetUnitId: string,
	tracking: T,
): SignedRecommendationTracking<T> {
	return {
		...tracking,
		signature: trackingDigest(targetUnitId, tracking).toString("base64url"),
	};
}

export function verifyRecommendationTracking(
	targetUnitId: string,
	tracking: SignedRecommendationTracking<RecommendationTrackingFields>,
) {
	const expected = trackingDigest(targetUnitId, tracking);
	const actual = Buffer.from(tracking.signature, "base64url");
	return actual.length === expected.length && timingSafeEqual(actual, expected);
}
