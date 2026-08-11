import { StatusCodes } from "http-status-codes";

import { workerReadinessPolicy } from "../../health-contract";
import { checkDatabase } from "./database";
import {
	createReadinessEvaluator,
	type HealthCheckDefinition,
	type ReadinessReport,
} from "./model";
import { createReadinessObserver } from "./observability";

export type WorkerHealthCheckName = keyof typeof workerReadinessPolicy.checks;

export class WorkerHealthState {
	#loopStarted = false;
	#stopping = false;
	#lastHeartbeatAt = 0;
	#activeJobStartedAt: number | undefined;

	start(): void {
		this.#loopStarted = true;
		this.heartbeat();
	}

	heartbeat(): void {
		this.#lastHeartbeatAt = Date.now();
	}

	startJob(): void {
		this.#activeJobStartedAt = Date.now();
		this.heartbeat();
	}

	finishJob(): void {
		this.#activeJobStartedAt = undefined;
		this.heartbeat();
	}

	stop(): void {
		this.#stopping = true;
		this.heartbeat();
	}

	isReady(now = Date.now()): boolean {
		return (
			this.#loopStarted &&
			!this.#stopping &&
			this.#lastHeartbeatAt > 0 &&
			now - this.#lastHeartbeatAt <= workerReadinessPolicy.maxHeartbeatAgeMs &&
			(this.#activeJobStartedAt === undefined ||
				now - this.#activeJobStartedAt <= workerReadinessPolicy.maxActiveJobAgeMs)
		);
	}

	activeJobStartedAt(): number | undefined {
		return this.#activeJobStartedAt;
	}
}

function workerReadinessDefinitions(
	state: WorkerHealthState,
): readonly HealthCheckDefinition<WorkerHealthCheckName>[] {
	return [
		{
			name: "database",
			...workerReadinessPolicy.checks.database,
			probe: checkDatabase,
		},
		{
			name: "worker_loop",
			...workerReadinessPolicy.checks.worker_loop,
			probe: async () => state.isReady(),
		},
	];
}

export function createWorkerReadinessEvaluator(
	state: WorkerHealthState,
	databaseProbe: (signal: AbortSignal) => Promise<boolean> = checkDatabase,
	onFreshReport: (report: ReadinessReport<WorkerHealthCheckName>) => void = createReadinessObserver(
		"recommendation-worker",
	),
) {
	const definitions = workerReadinessDefinitions(state).map((definition) =>
		definition.name === "database" ? { ...definition, probe: databaseProbe } : definition,
	);
	return createReadinessEvaluator(definitions, {
		overallTimeoutMs: workerReadinessPolicy.overallTimeoutMs,
		cacheTtlMs: workerReadinessPolicy.cacheTtlMs,
		onFreshReport,
	});
}

function reportCheck(report: ReadinessReport<WorkerHealthCheckName>, name: WorkerHealthCheckName) {
	const check = report.checks.find((candidate) => candidate.name === name);
	if (!check) throw new Error(`Worker readiness report omitted ${name}`);
	return { state: check.state, latencyMs: check.latencyMs };
}

function json(body: unknown, status: number): Response {
	return Response.json(body, { status });
}

export function createWorkerHealthHandler(
	evaluateReadiness: () => Promise<ReadinessReport<WorkerHealthCheckName>>,
): (request: Request) => Promise<Response> {
	return async (request) => {
		const path = new URL(request.url).pathname;
		if (path === "/startup" && request.method === "GET")
			return json({ status: "ok" }, StatusCodes.OK);
		if (path === "/health" && (request.method === "GET" || request.method === "HEAD"))
			return request.method === "HEAD"
				? new Response(null, { status: StatusCodes.NO_CONTENT })
				: json({ status: "ok" }, StatusCodes.OK);
		if (path === "/ready" && request.method === "GET") {
			const report = await evaluateReadiness();
			return json(
				{
					status: report.status,
					checks: {
						database: reportCheck(report, "database"),
						worker_loop: reportCheck(report, "worker_loop"),
					},
				},
				report.status === "ready" ? StatusCodes.OK : StatusCodes.SERVICE_UNAVAILABLE,
			);
		}
		return new Response(null, {
			status:
				path === "/startup" || path === "/health" || path === "/ready"
					? StatusCodes.METHOD_NOT_ALLOWED
					: StatusCodes.NOT_FOUND,
		});
	};
}
