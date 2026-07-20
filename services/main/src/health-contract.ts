export type HealthProbeContract = {
	readonly path: string;
	readonly intervalMs: number;
	readonly timeoutMs: number;
	readonly initialGraceMs: number;
	readonly failureThreshold: number;
};

export type SchedulerHealthContract = {
	readonly startup: HealthProbeContract & { readonly deadlineMs: number };
	readonly liveness: HealthProbeContract & { readonly restartsProcess: true };
	readonly readiness: HealthProbeContract & {
		readonly gatesDeployment: true;
		readonly gatesTraffic: boolean;
		readonly restartsProcess: false;
	};
	readonly deploymentHealthyDeadlineMs: number;
};

export const apiSchedulerHealthContract = {
	startup: {
		path: "/api/startup",
		intervalMs: 2_000,
		timeoutMs: 1_000,
		initialGraceMs: 2_000,
		failureThreshold: 60,
		deadlineMs: 180_000,
	},
	liveness: {
		path: "/api/health",
		intervalMs: 10_000,
		timeoutMs: 1_000,
		initialGraceMs: 10_000,
		failureThreshold: 3,
		restartsProcess: true,
	},
	readiness: {
		path: "/api/ready",
		intervalMs: 5_000,
		timeoutMs: 3_000,
		initialGraceMs: 5_000,
		failureThreshold: 1,
		gatesDeployment: true,
		gatesTraffic: true,
		restartsProcess: false,
	},
	deploymentHealthyDeadlineMs: 5 * 60_000,
} as const satisfies SchedulerHealthContract;

export const workerSchedulerHealthContract = {
	startup: {
		path: "/startup",
		intervalMs: 2_000,
		timeoutMs: 1_000,
		initialGraceMs: 2_000,
		failureThreshold: 60,
		deadlineMs: 180_000,
	},
	liveness: {
		path: "/health",
		intervalMs: 10_000,
		timeoutMs: 1_000,
		initialGraceMs: 10_000,
		failureThreshold: 3,
		restartsProcess: true,
	},
	readiness: {
		path: "/ready",
		intervalMs: 5_000,
		timeoutMs: 3_000,
		initialGraceMs: 5_000,
		failureThreshold: 1,
		gatesDeployment: true,
		gatesTraffic: false,
		restartsProcess: false,
	},
	deploymentHealthyDeadlineMs: 10 * 60_000,
} as const satisfies SchedulerHealthContract;

export const apiReadinessPolicy = {
	overallTimeoutMs: 2_000,
	cacheTtlMs: 1_000,
	checks: {
		database: { criticality: "required", timeoutMs: 1_000 },
		// Storage remains optional until the RustFS/R2 contract suite in Plan 5 is accepted.
		storage: { criticality: "optional", timeoutMs: 1_500 },
		recommendations: { criticality: "optional", timeoutMs: 1_500 },
	},
} as const;

export const workerReadinessPolicy = {
	overallTimeoutMs: 2_000,
	cacheTtlMs: 1_000,
	maxHeartbeatAgeMs: 15_000,
	maxActiveJobAgeMs: 15 * 60_000,
	checks: {
		database: { criticality: "required", timeoutMs: 1_000 },
		worker_loop: { criticality: "required", timeoutMs: 250 },
	},
} as const;
