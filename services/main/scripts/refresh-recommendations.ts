import {
	purgeRecommendationData,
	dispatchRecommendationRefresh,
} from "../src/services/recommendations/worker";
import { database } from "../src/services/database";
import { setTimeout as delay } from "node:timers/promises";
import { RecommendationPolicy } from "../src/services/recommendations/policy";

try {
	const deadline = Date.now() + RecommendationPolicy.buildDeadlineMs;
	let completed = false;
	while (Date.now() < deadline) {
		const result = await dispatchRecommendationRefresh();
		if (result.state === "failed") throw new Error(`Recommendation snapshot ${result.snapshotId} failed; inspect its durable partition diagnostics`);
		if (result.state === "ready" || result.state === "idle") {
			console.info("Recommendation refresh tick completed", result);
			completed = true;
			break;
		}
		await delay(1000);
	}
	if (!completed) throw new Error("Recommendation build exceeded the CLI deadline; durable progress remains available to workers");
	await purgeRecommendationData();
} finally {
	await database.$client.end();
}
