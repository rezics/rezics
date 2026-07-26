import type { ValidationError as ElysiaValidationError } from "elysia";

import { InternalError, ValidationError } from "./errors";

const MaximumLoggedValidationIssues = 20;

export interface ValidationIssueSummary {
	readonly message: string;
	readonly path: string;
}

export type ClassifiedValidationFailure =
	| {
			readonly kind: "request";
			readonly issues: readonly ValidationIssueSummary[];
			readonly publicError: ValidationError;
			readonly source: string;
	  }
	| {
			readonly kind: "response";
			readonly issues: readonly ValidationIssueSummary[];
			readonly publicError: InternalError;
			readonly source: "response";
	  };

/**
 * Keep validation diagnostics internal while preserving the trust boundary:
 * request validation is a client fault, response validation is a server fault.
 */
export function classifyValidationFailure(
	error: Pick<ElysiaValidationError, "all" | "type">,
): ClassifiedValidationFailure {
	const issues = error.all.slice(0, MaximumLoggedValidationIssues).map((issue) => ({
		message: issue.message,
		path: issue.path || "/",
	}));
	if (error.type === "response")
		return {
			kind: "response",
			issues,
			publicError: new InternalError(error),
			source: "response",
		};
	return {
		kind: "request",
		issues,
		publicError: new ValidationError(),
		source: error.type || "unknown",
	};
}
