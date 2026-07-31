import { StatusCodes } from "http-status-codes";
import { create } from "native-i18n";
import { resources } from "@rezics/i18n/resources";
import { ApiClientError } from "@rezics/openapi-tanstack-query";
import { describe, expect, it } from "vitest";

import {
	getErrorCode,
	getErrorDetails,
	getErrorText,
	getErrorStatus,
	hasErrorCode,
} from "./errors";

const i18n = create(resources);

describe("localized errors", () => {
	it("reads generated API failures from their nested public code", async () => {
		const { t } = await i18n.getTranslation(
			["betterAuthErrorCodes", "errorCodes", "errors"],
			["en"],
		);
		const error = new ApiClientError({
			data: {
				error: { code: "UnitChanged", message: "diagnostic only" },
				requestId: "request-1",
			},
			status: StatusCodes.CONFLICT,
			statusText: "Conflict",
			request: new Request("http://localhost/api/v1/units/book/unit-1"),
			response: new Response(null, { status: StatusCodes.CONFLICT }),
		});

		expect(getErrorCode(error)).toBe("UnitChanged");
		expect(getErrorStatus(error)).toBe(StatusCodes.CONFLICT);
		expect(getErrorDetails(error)).toBeUndefined();
		expect(getErrorText(t, error)).toBe(t.errorCodes.UnitChanged);
		expect(hasErrorCode(error, "UnitChanged")).toBe(true);
	});

	it("keeps error details unknown until an owning feature validates them", () => {
		const details = { realms: [{ realmId: "realm-a", revisionId: "revision-a" }] };
		expect(getErrorDetails({ data: { error: { details } } })).toBe(details);
		expect(getErrorDetails({ data: { error: null } })).toBeUndefined();
	});

	it("reads Better Auth failures from their direct code", async () => {
		const { t } = await i18n.getTranslation(
			["betterAuthErrorCodes", "errorCodes", "errors"],
			["en"],
		);
		const error = { code: "INVALID_EMAIL_OR_PASSWORD", message: "diagnostic only" };

		expect(getErrorCode(error)).toBe("INVALID_EMAIL_OR_PASSWORD");
		expect(getErrorText(t, error)).toBe(t.betterAuthErrorCodes.INVALID_EMAIL_OR_PASSWORD);
	});

	it("never exposes diagnostic messages for unknown or missing codes", async () => {
		const { t } = await i18n.getTranslation(
			["betterAuthErrorCodes", "errorCodes", "errors"],
			["en"],
		);
		expect(getErrorText(t, { code: "FUTURE_ERROR", message: "must not be shown" })).toBe(
			t.errors.unknownWithCode({ code: "FUTURE_ERROR" }),
		);
		expect(getErrorText(t, new TypeError("must not be shown"))).toBe(t.errors.unknown);
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
