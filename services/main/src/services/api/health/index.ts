import { StatusCodes } from "http-status-codes";
import Elysia from "elysia";

import { evaluateApiReadiness, type ApiHealthCheckName } from "../../health/api-readiness";
import type { HealthCheckResult, ReadinessReport } from "../../health/model";
import { NoContentResponse } from "../schema/action-response";
import { HealthResponse, ReadinessResponse } from "../schema/response";

function checkByName(
	report: ReadinessReport<ApiHealthCheckName>,
	name: ApiHealthCheckName,
): HealthCheckResult<ApiHealthCheckName> {
	const result = report.checks.find((check) => check.name === name);
	if (!result) throw new Error(`Readiness report omitted ${name}`);
	return result;
}

function publicCheck(result: HealthCheckResult<ApiHealthCheckName>) {
	return { state: result.state, latencyMs: result.latencyMs };
}

export function createHealthRoutes(
	evaluateReadiness: () => Promise<ReadinessReport<ApiHealthCheckName>>,
) {
	return new Elysia()
		.get("/startup", () => ({ status: "ok" as const }), {
			response: { [StatusCodes.OK]: HealthResponse },
			detail: { summary: "Process startup", tags: ["System"] },
		})
		.get("/health", () => ({ status: "ok" as const }), {
			response: { [StatusCodes.OK]: HealthResponse },
			detail: { summary: "Process health", tags: ["System"] },
		})
		.head("/health", () => new Response(null, { status: StatusCodes.NO_CONTENT }), {
			detail: {
				summary: "Process health without a response body",
				tags: ["System"],
				responses: NoContentResponse,
			},
		})
		.get(
			"/ready",
			async ({ status }) => {
				const report = await evaluateReadiness();
				return status(
					report.status === "ready" ? StatusCodes.OK : StatusCodes.SERVICE_UNAVAILABLE,
					{
						status: report.status,
						checks: {
							database: publicCheck(checkByName(report, "database")),
							storage: publicCheck(checkByName(report, "storage")),
							recommendations: publicCheck(checkByName(report, "recommendations")),
						},
					},
				);
			},
			{
				response: {
					[StatusCodes.OK]: ReadinessResponse,
					[StatusCodes.SERVICE_UNAVAILABLE]: ReadinessResponse,
				},
				detail: { summary: "Dependency readiness", tags: ["System"] },
			},
		);
}

export default createHealthRoutes(evaluateApiReadiness);
