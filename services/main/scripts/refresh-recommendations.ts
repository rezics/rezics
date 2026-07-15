import {
	aggregateRecommendationMetrics,
	purgeRecommendationData,
	refreshRecommendationSnapshot,
} from "../src/services/recommendations/worker";
import { database } from "../src/services/database";

try {
	const snapshotId = await refreshRecommendationSnapshot();
	if (!snapshotId) throw new Error("Recommendation refresh is already in progress");
	await aggregateRecommendationMetrics();
	await purgeRecommendationData();
	console.info("Recommendation refresh completed", { snapshotId });
} finally {
	await database.$client.end();
}
