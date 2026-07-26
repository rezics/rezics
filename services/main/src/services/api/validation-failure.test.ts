import { t, ValidationError as ElysiaValidationError } from "elysia";
import { StatusCodes } from "http-status-codes";
import { describe, expect, it } from "vitest";

import { toApiErrorBody } from "./errors";
import { classifyValidationFailure } from "./validation-failure";

const Schema = t.Object({ size: t.Integer({ minimum: 1 }) });

describe("API validation failure classification", () => {
	it("keeps request validation as a public 422 without exposing submitted values", () => {
		const failure = classifyValidationFailure(
			new ElysiaValidationError("body", Schema, { size: 0 }),
		);

		expect(failure).toMatchObject({
			kind: "request",
			source: "body",
			publicError: {
				_tag: "ValidationError",
				message: "Request validation failed",
				status: StatusCodes.UNPROCESSABLE_ENTITY,
			},
		});
		expect(failure.issues).toEqual([expect.objectContaining({ path: "/size" })]);
		if (failure.kind !== "request") throw new Error("Expected request validation failure");
		expect(toApiErrorBody(failure.publicError, "request-id")).toEqual({
			error: {
				code: "ValidationError",
				message: "Request validation failed",
			},
			requestId: "request-id",
		});
	});

	it("treats response validation as an internal 500 while retaining safe diagnostics", () => {
		const failure = classifyValidationFailure(
			new ElysiaValidationError("response", Schema, { size: "invalid" }),
		);

		expect(failure).toMatchObject({
			kind: "response",
			source: "response",
			publicError: {
				_tag: "InternalError",
				message: "Internal server error",
				status: StatusCodes.INTERNAL_SERVER_ERROR,
			},
		});
		expect(failure.issues).toEqual([expect.objectContaining({ path: "/size" })]);
		expect(toApiErrorBody(failure.publicError, "request-id")).toEqual({
			error: {
				code: "InternalError",
				message: "Internal server error",
			},
			requestId: "request-id",
		});
	});
});
