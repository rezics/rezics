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
	accountErasureWorker,
	studioCandidateCleanup,
	unitMergeWorker,
	unitMergeService,
	bookChapterDraftWorker,
	tagExpressionProjectionWorker,
	customThemeReview,
	customThemeMonitor,
	workerHealth,
] = await Promise.all([
	import("srvx"),
	import("./services/config"),
	import("./services/database"),
	import("./services/recommendations/worker"),
	import("./services/email/dispatcher"),
	import("./services/image-assets/cleanup"),
	import("./services/auth/api-quota/cleanup"),
	import("./services/participation/erasure"),
	import("./services/studio/cleanup"),
	import("./services/units/merge/worker"),
	import("./services/units/merge/service"),
	import("./services/units/book-chapter-draft-worker"),
	import("./services/tag-expressions/projection-worker"),
	import("./services/custom-themes/review"),
	import("./services/custom-themes/monitor"),
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
const { dispatchBookChapterDraftJobs } = bookChapterDraftWorker;
const { dispatchTagExpressionProjectionRebuilds } = tagExpressionProjectionWorker;
const { reviewPendingCustomThemeRevisionBatch } = customThemeReview;
const { monitorCustomThemeExternalResourceBatch } = customThemeMonitor;
const { logger } = observability;
const healthState = new workerHealth.WorkerHealthState();
const evaluateReadiness = workerHealth.createWorkerReadinessEvaluator(healthState);
const healthServer = serve({
	fetch: workerHealth.createWorkerHealthHandler(evaluateReadiness),
	hostname: env.WORKER_HEALTH_HOST,
	port: env.WORKER_HEALTH_PORT,
});

const { runWorkerLane } = await import("./services/workers/scheduler");
const shutdown = new AbortController();
for (const signal of ["SIGINT", "SIGTERM"] as const) {
	process.on(signal, () => {
		healthState.stop();
		shutdown.abort();
	});
}

healthState.start();
const heartbeatTimer = setInterval(() => {
	healthState.heartbeat();
	observability.metrics.workerHeartbeat(healthState.activeJobStartedAt());
}, 5_000);
heartbeatTimer.unref?.();
observability.metrics.workerHeartbeat();

const pollInterval = env.EMAIL_DISPATCH_POLL_INTERVAL_MS;
const lanes = {
	delivery: [{ name: "email.dispatch", intervalMs: pollInterval, run: dispatchEmailBatch }],
	canonical: [
		{
			name: "unit_merge.dispatch",
			intervalMs: pollInterval,
			run: async () => {
				await dispatchUnitMergeBatch();
				await expireUnitMergeRequests();
			},
		},
		{
			name: "book_chapter_draft.dispatch",
			intervalMs: pollInterval,
			run: dispatchBookChapterDraftJobs,
		},
	],
	projection: [
		{
			name: "tag_expression_projection.dispatch",
			intervalMs: pollInterval,
			run: dispatchTagExpressionProjectionRebuilds,
		},
		{
			name: "recommendation.refresh",
			intervalMs: env.RECOMMENDATION_REFRESH_INTERVAL_MS,
			run: async () => {
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
			},
		},
	],
	maintenance: [
		{
			name: "account_erasure.dispatch",
			intervalMs: 1000,
			run: accountErasureWorker.dispatchAccountErasureBatch,
		},
		{
			name: "image_asset.cleanup",
			intervalMs: env.IMAGE_ASSET_CLEANUP_INTERVAL_MS,
			run: cleanupExpiredPendingImageAssets,
		},
		{
			name: "api_quota.cleanup",
			intervalMs: env.API_QUOTA_CLEANUP_INTERVAL_MS,
			run: cleanupApiQuotaState,
		},
		{
			name: "studio_candidate.cleanup",
			intervalMs: env.STUDIO_CANDIDATE_CLEANUP_INTERVAL_MS,
			run: () =>
				cleanupExpiredStudioEditorCandidates({
					batchSize: env.STUDIO_CANDIDATE_CLEANUP_BATCH_SIZE,
				}),
		},
	],
	external: [
		{
			name: "custom_theme.review",
			intervalMs: env.CUSTOM_THEME_REVIEW_INTERVAL_MS,
			run: () => reviewPendingCustomThemeRevisionBatch(env.CUSTOM_THEME_REVIEW_BATCH_SIZE),
		},
		{
			name: "custom_theme.monitor",
			intervalMs: env.CUSTOM_THEME_MONITOR_INTERVAL_MS,
			run: async () => {
				const result = await monitorCustomThemeExternalResourceBatch(
					env.CUSTOM_THEME_MONITOR_BATCH_SIZE,
				);
				if (result.checked > 0)
					logger.info("Custom Theme external-resource monitor batch completed", {
						eventName: "custom_theme.monitor.completed",
						attributes: { ...result },
					});
				if (result.oldestQueueAgeMilliseconds > 5 * 60_000)
					logger.warn("Custom Theme unpinned-resource monitor objective missed", {
						eventName: "custom_theme.monitor.queue_age_exceeded",
						attributes: { ...result },
					});
			},
		},
	],
} satisfies Record<
	import("./services/workers/scheduler").WorkerLane,
	readonly import("./services/workers/scheduler").ScheduledWorkerJob[]
>;

try {
	await Promise.all(
		env.WORKER_LANES.map((lane) =>
			runWorkerLane(
				lanes[lane].map((job) => ({
					...job,
					run: () => runWorkerJob({ name: job.name, retryCount: 0 }, async () => await job.run()),
				})),
				{
					signal: shutdown.signal,
					onStart: (name) => {
						healthState.startJob(name);
						observability.metrics.workerHeartbeat(healthState.activeJobStartedAt());
					},
					onFinish: (name) => {
						healthState.finishJob(name);
						observability.metrics.workerHeartbeat(healthState.activeJobStartedAt());
					},
					onError: () => {
						// runWorkerJob records failure telemetry. Other jobs and lanes keep running.
					},
				},
			),
		),
	);
} finally {
	clearInterval(heartbeatTimer);
	await healthServer.close();
	await database.$client.end();
	await observability.shutdown();
}
