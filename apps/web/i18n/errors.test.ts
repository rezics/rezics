import { StatusCodes } from "http-status-codes";
import enUS from "@rezics/i18n/languages/en-US";
import { ApiClientError } from "@rezics/openapi-tanstack-query";
import { describe, expect, it } from "vitest";

import { getErrorCode, getErrorText, getErrorStatus, hasErrorCode } from "./errors";

describe("localized errors", () => {
	it("reads generated API failures from their nested public code", () => {
		const error = new ApiClientError({
			data: {
				error: { code: "UnitChanged", message: "diagnostic only" },
				requestId: "request-1",
			},
			status: StatusCodes.CONFLICT,
			statusText: "Conflict",
			request: new Request("http://localhost/api/units/book/unit-1"),
			response: new Response(null, { status: StatusCodes.CONFLICT }),
		});

		expect(getErrorCode(error)).toBe("UnitChanged");
		expect(getErrorStatus(error)).toBe(StatusCodes.CONFLICT);
		expect(getErrorText(enUS, error)).toBe(enUS.errorCodes.UnitChanged);
		expect(hasErrorCode(error, "UnitChanged")).toBe(true);
	});

	it("reads Better Auth failures from their direct code", () => {
		const error = { code: "INVALID_EMAIL_OR_PASSWORD", message: "diagnostic only" };

		expect(getErrorCode(error)).toBe("INVALID_EMAIL_OR_PASSWORD");
		expect(getErrorText(enUS, error)).toBe(enUS.betterAuthErrorCodes.INVALID_EMAIL_OR_PASSWORD);
	});

	it("never exposes diagnostic messages for unknown or missing codes", () => {
		expect(getErrorText(enUS, { code: "FUTURE_ERROR", message: "must not be shown" })).toBe(
			enUS.errors.unknownWithCode("FUTURE_ERROR"),
		);
		expect(getErrorText(enUS, new TypeError("must not be shown"))).toBe(enUS.errors.unknown);
	});

	it("rejects malformed error fields at the schema boundary", () => {
		expect(getErrorCode({ data: { error: { code: StatusCodes.CONFLICT } } })).toBeUndefined();
		expect(getErrorCode({ code: StatusCodes.CONFLICT })).toBeUndefined();
		expect(getErrorStatus({ status: String(StatusCodes.CONFLICT) })).toBeUndefined();
		expect(getErrorStatus({ status: Number.NaN })).toBeUndefined();
		expect(getErrorStatus({ status: 99 })).toBeUndefined();
		expect(getErrorStatus({ status: 600 })).toBeUndefined();
	});

	it("prefers a valid nested code and accepts HTTP status boundaries", () => {
		expect(
			getErrorCode({
				code: "INVALID_EMAIL_OR_PASSWORD",
				data: { error: { code: "UnitChanged" } },
			}),
		).toBe("UnitChanged");
		expect(
			getErrorCode({ code: "INVALID_EMAIL_OR_PASSWORD", data: { error: { code: 409 } } }),
		).toBe("INVALID_EMAIL_OR_PASSWORD");
		expect(getErrorStatus({ status: 100 })).toBe(100);
		expect(getErrorStatus({ status: 599 })).toBe(599);
	});
});
