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

function validationIssuePath(value: unknown): string | undefined {
	if (typeof value !== "string") return undefined;
	if (!value || value === "root") return "/";
	if (value.startsWith("/")) return value;
	return `/${value.replaceAll(".", "/")}`;
}

function rawIssuePath(value: unknown): string | undefined {
	if (typeof value !== "object" || value === null || !("instancePath" in value)) return undefined;
	return validationIssuePath(value.instancePath);
}

function rawIssueMessage(value: unknown): unknown {
	return typeof value === "object" && value !== null && "message" in value
		? value.message
		: undefined;
}

/**
 * Keep validation diagnostics internal while preserving the trust boundary:
 * request validation is a client fault, response validation is a server fault.
 */
export function classifyValidationFailure(
	error: Pick<ElysiaValidationError, "all" | "errors" | "type">,
): ClassifiedValidationFailure {
	const claimedRawIssues = new Set<unknown>();
	const issues = error.all.slice(0, MaximumLoggedValidationIssues).map((issue) => {
		const rawIssue = error.errors.find(
			(candidate) =>
				!claimedRawIssues.has(candidate) && rawIssueMessage(candidate) === issue.message,
		);
		if (rawIssue !== undefined) claimedRawIssues.add(rawIssue);
		return {
			message: issue.message,
			path: rawIssuePath(rawIssue) ?? validationIssuePath(issue.path) ?? "/",
		};
	});
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
