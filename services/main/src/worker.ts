import { initializeObservability, runWorkerJob } from "@rezics/observability";

import { RezicsVersion } from "./version";

const observability = initializeObservability({
	service: {
		name: "rezics-main-worker",
		version: RezicsVersion,
		environment: process.env.DEPLOYMENT_ENVIRONMENT ?? process.env.NODE_ENV ?? "development",
	},
});

const [
	{ serve },
	{ env },
	{ database },
	recommendationWorker,
	emailDispatcher,
	imageAssetCleanup,
	apiQuotaCleanup,
	workerHealth,
] = await Promise.all([
	import("srvx"),
	import("./services/config"),
	import("./services/database"),
	import("./services/recommendations/worker"),
	import("./services/email/dispatcher"),
	import("./services/image-assets/cleanup"),
	import("./services/auth/api-quota/cleanup"),
	import("./services/health/worker-health"),
]);
const { aggregateRecommendationMetrics, purgeRecommendationData, refreshRecommendationSnapshot } =
	recommendationWorker;
const { dispatchEmailBatch } = emailDispatcher;
const { cleanupExpiredPendingImageAssets } = imageAssetCleanup;
const { cleanupApiQuotaState } = apiQuotaCleanup;
const { logger } = observability;
const healthState = new workerHealth.WorkerHealthState();
const evaluateReadiness = workerHealth.createWorkerReadinessEvaluator(healthState);
const healthServer = serve({
	fetch: workerHealth.createWorkerHealthHandler(evaluateReadiness),
	hostname: env.WORKER_HEALTH_HOST,
	port: env.WORKER_HEALTH_PORT,
});

let stopping = false;
let wake: (() => void) | undefined;

for (const signal of ["SIGINT", "SIGTERM"] as const) {
	process.on(signal, () => {
		stopping = true;
		healthState.stop();
		wake?.();
	});
}

healthState.start();
const heartbeatTimer = setInterval(() => {
	healthState.heartbeat();
	observability.metrics.workerHeartbeat(healthState.activeJobStartedAt());
}, 5_000);
heartbeatTimer.unref?.();
observability.metrics.workerHeartbeat();

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
	let nextRecommendationAt = 0;
	let nextImageAssetCleanupAt = 0;
	let nextApiQuotaCleanupAt = 0;
	while (!stopping) {
		healthState.startJob();
		observability.metrics.workerHeartbeat(healthState.activeJobStartedAt());
		try {
			await runWorkerJob({ name: "email.dispatch", retryCount: 0 }, dispatchEmailBatch);
			if (Date.now() >= nextRecommendationAt) {
				nextRecommendationAt = Date.now() + env.RECOMMENDATION_REFRESH_INTERVAL_MS;
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
			}
			if (Date.now() >= nextImageAssetCleanupAt) {
				nextImageAssetCleanupAt = Date.now() + env.IMAGE_ASSET_CLEANUP_INTERVAL_MS;
				await runWorkerJob({ name: "image_asset.cleanup", retryCount: 0 }, async () => {
					const cleaned = await cleanupExpiredPendingImageAssets();
					if (cleaned > 0)
						logger.info("Expired image assets cleaned", {
							eventName: "image_asset.cleanup.completed",
							attributes: { cleaned },
						});
				});
			}
			if (Date.now() >= nextApiQuotaCleanupAt) {
				nextApiQuotaCleanupAt = Date.now() + env.API_QUOTA_CLEANUP_INTERVAL_MS;
				await runWorkerJob({ name: "api_quota.cleanup", retryCount: 0 }, async () => {
					const cleaned = await cleanupApiQuotaState();
					if (cleaned > 0)
						logger.info("Expired API quota state cleaned", {
							eventName: "api_quota.cleanup.completed",
							attributes: { cleaned },
						});
				});
			}
		} catch {
			// runWorkerJob records the bounded failure telemetry before control returns here.
		} finally {
			healthState.finishJob();
			observability.metrics.workerHeartbeat();
		}
		if (!stopping) await wait(env.EMAIL_DISPATCH_POLL_INTERVAL_MS);
	}
}

try {
	await run();
} finally {
	clearInterval(heartbeatTimer);
	await healthServer.close();
	await database.$client.end();
	await observability.shutdown();
}
