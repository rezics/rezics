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
	studioCandidateCleanup,
	unitMergeWorker,
	unitMergeService,
	workerHealth,
] = await Promise.all([
	import("srvx"),
	import("./services/config"),
	import("./services/database"),
	import("./services/recommendations/worker"),
	import("./services/email/dispatcher"),
	import("./services/image-assets/cleanup"),
	import("./services/auth/api-quota/cleanup"),
	import("./services/studio/cleanup"),
	import("./services/units/merge/worker"),
	import("./services/units/merge/service"),
	import("./services/health/worker-health"),
]);
const { aggregateRecommendationMetrics, purgeRecommendationData, refreshRecommendationSnapshot } =
	recommendationWorker;
const { dispatchEmailBatch } = emailDispatcher;
const { cleanupExpiredPendingImageAssets } = imageAssetCleanup;
const { cleanupApiQuotaState } = apiQuotaCleanup;
const { cleanupExpiredStudioEditorCandidates } = studioCandidateCleanup;
const { dispatchUnitMergeBatch } = unitMergeWorker;
const { expireUnitMergeRequests } = unitMergeService;
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
	let nextStudioCandidateCleanupAt = 0;
	while (!stopping) {
		healthState.startJob();
		observability.metrics.workerHeartbeat(healthState.activeJobStartedAt());
		try {
			await runWorkerJob({ name: "email.dispatch", retryCount: 0 }, dispatchEmailBatch);
			await runWorkerJob({ name: "unit_merge.dispatch", retryCount: 0 }, async () => {
				await dispatchUnitMergeBatch();
				await expireUnitMergeRequests();
			});
			if (Date.now() >= nextRecommendationAt) {
				try {
					await runWorkerJob({ name: "recommendation.refresh", retryCount: 0 }, async () => {
						const snapshotId = await refreshRecommendationSnapshot();
						await aggregateRecommendationMetrics();
						await purgeRecommendationData();
						logger.info(
							snapshotId ? "Recommendation refresh completed" : "Recommendation refresh skipped",
							{
								eventName: snapshotId
									? "recommendation.refresh.completed"
									: "recommendation.refresh.skipped",
							},
						);
					});
				} finally {
					nextRecommendationAt = Date.now() + env.RECOMMENDATION_REFRESH_INTERVAL_MS;
				}
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
			if (Date.now() >= nextStudioCandidateCleanupAt) {
				nextStudioCandidateCleanupAt = Date.now() + env.STUDIO_CANDIDATE_CLEANUP_INTERVAL_MS;
				await runWorkerJob({ name: "studio_candidate.cleanup", retryCount: 0 }, async () => {
					const cleaned = await cleanupExpiredStudioEditorCandidates({
						batchSize: env.STUDIO_CANDIDATE_CLEANUP_BATCH_SIZE,
					});
					if (cleaned > 0)
						logger.info("Expired Studio editor candidates cleaned", {
							eventName: "studio_candidate.cleanup.completed",
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
