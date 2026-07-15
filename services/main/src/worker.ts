import { env } from "./services/config";
import { database } from "./services/database";
import {
	aggregateRecommendationMetrics,
	purgeRecommendationData,
	refreshRecommendationSnapshot,
} from "./services/recommendations/worker";

let stopping = false;
let wake: (() => void) | undefined;

for (const signal of ["SIGINT", "SIGTERM"] as const) {
	process.on(signal, () => {
		stopping = true;
		wake?.();
	});
}

function wait(duration: number) {
	return new Promise<void>((resolve) => {
		const timer = setTimeout(() => {
			wake = undefined;
			resolve();
		}, duration);
		wake = () => {
			clearTimeout(timer);
			wake = undefined;
			resolve();
		};
	});
}

async function run() {
	while (!stopping) {
		const startedAt = Date.now();
		try {
			const snapshotId = await refreshRecommendationSnapshot();
			await aggregateRecommendationMetrics();
			await purgeRecommendationData();
			console.info(
				snapshotId ? "Recommendation refresh completed" : "Recommendation refresh skipped",
				{
					snapshotId,
					durationMs: Date.now() - startedAt,
				},
			);
		} catch (error) {
			console.error("Recommendation refresh failed", { error });
		}
		if (!stopping) await wait(env.RECOMMENDATION_REFRESH_INTERVAL_MS);
	}
}

try {
	await run();
} finally {
	await database.$client.end();
}
