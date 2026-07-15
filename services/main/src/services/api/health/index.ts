import { StatusCodes } from "http-status-codes";
import Elysia from "elysia";

import { database } from "../../database";
import { unit } from "../../database/schema";
import { storage } from "../../storage";
import { getRecommendationHealth } from "../../recommendations/worker";
import { NoContentResponse } from "../schema/action-response";
import { HealthResponse, ReadinessResponse } from "../schema/response";

export default new Elysia()
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
			const [databaseCheck, storageCheck, recommendationCheck] = await Promise.allSettled([
				database.select({ id: unit.id }).from(unit).limit(1),
				storage.health(),
				getRecommendationHealth(),
			]);
			const ready =
				databaseCheck.status === "fulfilled" &&
				storageCheck.status === "fulfilled" &&
				recommendationCheck.status === "fulfilled";
			return status(ready ? StatusCodes.OK : StatusCodes.SERVICE_UNAVAILABLE, {
				status: ready ? "ready" : "unavailable",
				services: {
					database: databaseCheck.status === "fulfilled",
					storage: storageCheck.status === "fulfilled",
					recommendations:
						recommendationCheck.status === "fulfilled" &&
						recommendationCheck.value.ready,
				},
			});
		},
		{
			response: {
				[StatusCodes.OK]: ReadinessResponse,
				[StatusCodes.SERVICE_UNAVAILABLE]: ReadinessResponse,
			},
			detail: { summary: "Dependency readiness", tags: ["System"] },
		},
	);
