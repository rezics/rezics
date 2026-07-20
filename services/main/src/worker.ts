import { initializeObservability, runWorkerJob } from "@rezics/observability";

const observability = initializeObservability({
	service: {
		name: "rezics-recommendation-worker",
		version: "0.1.0",
		environment: process.env.DEPLOYMENT_ENVIRONMENT ?? process.env.NODE_ENV ?? "development",
	},
});

const [{ env }, { database }, recommendationWorker] = await Promise.all([
	import("./services/config"),
	import("./services/database"),
	import("./services/recommendations/worker"),
]);
const { aggregateRecommendationMetrics, purgeRecommendationData, refreshRecommendationSnapshot } =
	recommendationWorker;
const { logger } = observability;

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
		try {
			await runWorkerJob({ name: "recommendation.refresh", retryCount: 0 }, async () => {
				const snapshotId = await refreshRecommendationSnapshot();
				await aggregateRecommendationMetrics();
				await purgeRecommendationData();
				logger.info(
					snapshotId
						? "Recommendation refresh completed"
						: "Recommendation refresh skipped",
					{
						eventName: snapshotId
							? "recommendation.refresh.completed"
							: "recommendation.refresh.skipped",
					},
				);
			});
		} catch {}
		if (!stopping) await wait(env.RECOMMENDATION_REFRESH_INTERVAL_MS);
	}
}

try {
	await run();
} finally {
	await database.$client.end();
	await observability.shutdown();
}
