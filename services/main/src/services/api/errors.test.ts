import { StatusCodes } from "http-status-codes";
import { describe, expect, it } from "vitest";

import { VndbVoteHotKeyBusy } from "../database/errors";
import { SearchUnavailable } from "../search/errors";
import { UnitPermissionForbidden } from "../units/errors";
import { RealmRuleRevisionChanged } from "./realms/errors";
import {
	apiErrorRetryAfterSeconds,
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

		const revisionChanged = new RealmRuleRevisionChanged({
			currentRevisionId: "019f995d-7595-7c99-9183-250790bbfe2f",
		});
		expect(toApiErrorBody(revisionChanged, "request-2")).toEqual({
			error: {
				code: "RealmRuleRevisionChanged",
				message: "The current Realm rule revision has changed",
				details: {
					currentRevisionId: "019f995d-7595-7c99-9183-250790bbfe2f",
				},
			},
			requestId: "request-2",
		});

		const busy = new VndbVoteHotKeyBusy(new Error("database diagnostic"));
		expect(busy.status).toBe(StatusCodes.TOO_MANY_REQUESTS);
		expect(apiErrorRetryAfterSeconds(busy)).toBe(1);
		expect(toApiErrorBody(busy, "request-3")).toEqual({
			error: {
				code: "VndbVoteHotKeyBusy",
				message: "The vote target is busy; retry shortly",
			},
			requestId: "request-3",
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
