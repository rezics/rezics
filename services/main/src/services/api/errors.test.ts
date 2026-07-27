import { StatusCodes } from "http-status-codes";
import { describe, expect, it } from "vitest";

import { SearchUnavailable } from "../search/errors";
import { UnitPermissionForbidden } from "../units/errors";
import {
	ApiErrorCodes,
	ApiErrorRegistry,
	ApiErrors,
	toApiErrorBody,
	isApiError,
	isApiErrorCode,
	MalformedRequestBody,
} from "./errors";

describe("API errors", () => {
	it("serializes typed failures without exposing their cause", () => {
		const failure = new UnitPermissionForbidden("unit.update", ["title"]);

		expect(failure).toBeInstanceOf(Error);
		expect(failure._tag).toBe("UnitPermissionForbidden");
		expect(isApiError(failure)).toBe(true);
		expect(failure.status).toBe(StatusCodes.FORBIDDEN);
		expect(toApiErrorBody(failure, "request-1")).toEqual({
			error: {
				code: "UnitPermissionForbidden",
				message: "Unit permission required: unit.update",
				details: { permission: "unit.update", scope: ["title"] },
			},
			requestId: "request-1",
		});

		const unavailable = new SearchUnavailable(new Error("search diagnostic"));
		expect(toApiErrorBody(unavailable, "request-1")).toEqual({
			error: { code: "SearchUnavailable", message: "Search service unavailable" },
			requestId: "request-1",
		});

		const malformedRequestBody = new MalformedRequestBody();
		expect(malformedRequestBody.status).toBe(StatusCodes.BAD_REQUEST);
		expect(toApiErrorBody(malformedRequestBody, "request-1")).toEqual({
			error: {
				code: "MalformedRequestBody",
				message: "Request body is malformed",
			},
			requestId: "request-1",
		});
	});

	it("keeps the public error registry unique and discriminated", () => {
		expect(ApiErrorCodes).toHaveLength(ApiErrors.length);
		expect(new Set(ApiErrorCodes)).toHaveLength(ApiErrorCodes.length);
		expect(Object.keys(ApiErrorRegistry)).toEqual(ApiErrorCodes);
		expect(Object.values(ApiErrorRegistry)).toEqual([...ApiErrors]);
		expect(ApiErrorCodes.every((code) => /^[A-Z][A-Za-z0-9]*$/.test(code))).toBe(true);
		expect(ApiErrorCodes.every(isApiErrorCode)).toBe(true);
		expect(isApiErrorCode("NOT_REGISTERED")).toBe(false);
		expect(isApiError({ _tag: "UnitChanged", status: StatusCodes.CONFLICT })).toBe(false);
	});
});
