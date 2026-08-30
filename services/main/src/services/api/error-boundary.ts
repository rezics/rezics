import { getActiveObservability } from "@rezics/observability";
import Elysia, { ParseError, ValidationError as ElysiaValidationError } from "elysia";

import { getAuditRequestContext } from "../audit";
import { toTagPolicyConstraintError } from "../database/errors";
import { toPostTargetingConstraintError } from "../posts/targeting";
import { toTagPathConstraintError } from "../tag-paths/service";
import { toUnitVariantConstraintError } from "../units/variants";
import {
	apiErrorRetryAfterSeconds,
	InternalError,
	isApiError,
	MalformedRequestBody,
	toApiErrorBody,
} from "./errors";
import { classifyValidationFailure } from "./validation-failure";

const { logger } = getActiveObservability();

export default new Elysia({ name: "api-error-boundary" }).error(
	"global",
	({ error, request, route, set, status }) => {
		const requestId = getAuditRequestContext()?.requestId ?? crypto.randomUUID();
		if (isApiError(error)) {
			const retryAfterSeconds = apiErrorRetryAfterSeconds(error);
			if (retryAfterSeconds !== undefined) set.headers["Retry-After"] = String(retryAfterSeconds);
			return status(error.status, toApiErrorBody(error, requestId));
		}
		const tagPolicyConstraintError = toTagPolicyConstraintError(error);
		if (tagPolicyConstraintError)
			return status(
				tagPolicyConstraintError.status,
				toApiErrorBody(tagPolicyConstraintError, requestId),
			);
		const variantConstraintError = toUnitVariantConstraintError(error);
		if (variantConstraintError)
			return status(
				variantConstraintError.status,
				toApiErrorBody(variantConstraintError, requestId),
			);
		const postTargetingConstraintError = toPostTargetingConstraintError(error);
		if (postTargetingConstraintError)
			return status(
				postTargetingConstraintError.status,
				toApiErrorBody(postTargetingConstraintError, requestId),
			);
		const tagPathConstraintError = toTagPathConstraintError(error);
		if (tagPathConstraintError)
			return status(
				tagPathConstraintError.status,
				toApiErrorBody(tagPathConstraintError, requestId),
			);
		if (error instanceof ParseError) {
			const malformedRequestBody = new MalformedRequestBody();
			return status(malformedRequestBody.status, toApiErrorBody(malformedRequestBody, requestId));
		}
		if (error instanceof ElysiaValidationError) {
			const failure = classifyValidationFailure(error);
			const details = {
				eventName:
					failure.kind === "response"
						? "http.response.validation_failed"
						: "http.request.validation_failed",
				errorCode: failure.publicError.type,
				request: { method: request.method, route: route ?? "unmatched" },
				attributes: {
					requestId,
					validationIssues: failure.issues,
					validationSource: failure.source,
				},
			};
			if (failure.kind === "response")
				logger.error("Response validation failed", { ...details, error });
			else logger.info("Request validation failed", details);
			return status(failure.publicError.status, toApiErrorBody(failure.publicError, requestId));
		}
		logger.error("Request failed", {
			eventName: "http.request.failed",
			errorCode: "InternalError",
			request: { method: request.method, route: route ?? "unmatched" },
			error,
			attributes: { requestId },
		});
		const internalError = new InternalError(error);
		return status(internalError.status, toApiErrorBody(internalError, requestId));
	},
);
