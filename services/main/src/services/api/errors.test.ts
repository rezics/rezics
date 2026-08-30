import { StatusCodes } from "http-status-codes";
import Elysia, { HTTPError } from "elysia";
import { describe, expect, it } from "vitest";

import { enterAuditRequestContext } from "../audit";
import { VoteHotKeyBusy } from "../database/errors";
import { SearchUnavailable } from "../search/errors";
import { UnitPermissionForbidden } from "../units/errors";
import { ContentLabelApplicationInvalid } from "../database/errors";
import { DockRevisionConflict } from "./docks/errors";
import { UnitMergeMeasurementConflict } from "./governance/errors";
import { ApiQuotaPolicyInvalid } from "./quota-policies/errors";
import { RealmRuleRevisionChanged } from "./realms/errors";
import errorBoundary from "./error-boundary";
import {
	apiErrorRetryAfterSeconds,
	ApiErrorCodes,
	ApiErrorRegistry,
	ApiErrors,
	toApiErrorBody,
	isApiError,
	isApiErrorCode,
	InternalError,
	MalformedRequestBody,
} from "./errors";

describe("API errors", () => {
	it("preserves the native and wire contract across representative status classes", () => {
		const diagnostic = new Error("private database diagnostic");
		const requestId = "019f9e37-a504-7dde-be38-0757f2d31411";
		const cases = [
			{
				error: new MalformedRequestBody(),
				ErrorClass: MalformedRequestBody,
				status: StatusCodes.BAD_REQUEST,
				code: "MalformedRequestBody",
			},
			{
				error: new UnitPermissionForbidden("unit.update", ["title"]),
				ErrorClass: UnitPermissionForbidden,
				status: StatusCodes.FORBIDDEN,
				code: "UnitPermissionForbidden",
			},
			{
				error: new RealmRuleRevisionChanged({ currentRevisionId: requestId }),
				ErrorClass: RealmRuleRevisionChanged,
				status: StatusCodes.CONFLICT,
				code: "RealmRuleRevisionChanged",
			},
			{
				error: new ApiQuotaPolicyInvalid(),
				ErrorClass: ApiQuotaPolicyInvalid,
				status: StatusCodes.UNPROCESSABLE_ENTITY,
				code: "ApiQuotaPolicyInvalid",
			},
			{
				error: new VoteHotKeyBusy(diagnostic),
				ErrorClass: VoteHotKeyBusy,
				status: StatusCodes.TOO_MANY_REQUESTS,
				code: "VoteHotKeyBusy",
			},
			{
				error: new InternalError(diagnostic),
				ErrorClass: InternalError,
				status: StatusCodes.INTERNAL_SERVER_ERROR,
				code: "InternalError",
			},
		] as const;

		for (const { error, ErrorClass, status, code } of cases) {
			expect(error).toBeInstanceOf(ErrorClass);
			expect(error).toBeInstanceOf(HTTPError);
			expect(error.type).toBe(code);
			expect(error.status).toBe(status);
			expect(isApiError(error)).toBe(true);
			const body = toApiErrorBody(error, requestId);
			expect(body.requestId).toBe(requestId);
			expect(body.error.code).toBe(code);
			expect(body.error.message).toBe(error.message);
			expect(JSON.stringify(body)).not.toContain(diagnostic.message);
		}

		expect(apiErrorRetryAfterSeconds(cases[4].error)).toBe(1);
		expect(apiErrorRetryAfterSeconds(cases[0].error)).toBeUndefined();
	});

	it("does not recognize an unregistered third-party HTTPError as a REZICS error", () => {
		class ThirdPartyFailure extends HTTPError.id("ThirdPartyFailure", StatusCodes.IM_A_TEAPOT) {
			override readonly message = "third-party diagnostic";
		}

		const failure = new ThirdPartyFailure();
		expect(failure).toBeInstanceOf(HTTPError);
		expect(isApiError(failure)).toBe(false);
		expect(isApiErrorCode(failure.type)).toBe(false);

		const masked = new InternalError(failure);
		expect(masked.cause).toBe(failure);
		expect(toApiErrorBody(masked, "019f9e37-a504-7dde-be38-0757f2d31411").error).toEqual({
			code: "InternalError",
			message: "Internal server error",
		});
	});

	it("maps the full status matrix through the same global Elysia error boundary", async () => {
		class ThirdPartyFailure extends HTTPError.id("ThirdPartyFailure", StatusCodes.IM_A_TEAPOT) {
			override readonly message = "private third-party diagnostic";
		}
		const failures = {
			badRequest: new MalformedRequestBody(),
			forbidden: new UnitPermissionForbidden("unit.update", ["title"]),
			conflict: new RealmRuleRevisionChanged({
				currentRevisionId: "019f9e37-a504-7dde-be38-0757f2d31411",
			}),
			unprocessable: new ApiQuotaPolicyInvalid(),
			busy: new VoteHotKeyBusy(new Error("private database diagnostic")),
			internal: new Error("private unknown diagnostic"),
			thirdParty: new ThirdPartyFailure(),
		} as const;
		const app = new Elysia()
			.request(({ set }) => {
				const requestId = crypto.randomUUID();
				enterAuditRequestContext({ requestId });
				set.headers["X-Request-Id"] = requestId;
			})
			.use(errorBoundary)
			.get("/:failure", ({ params }) => {
				const failure = failures[params.failure as keyof typeof failures];
				if (!failure) throw new Error("unknown fixture");
				throw failure;
			});
		const expected = [
			["badRequest", StatusCodes.BAD_REQUEST, "MalformedRequestBody"],
			["forbidden", StatusCodes.FORBIDDEN, "UnitPermissionForbidden"],
			["conflict", StatusCodes.CONFLICT, "RealmRuleRevisionChanged"],
			["unprocessable", StatusCodes.UNPROCESSABLE_ENTITY, "ApiQuotaPolicyInvalid"],
			["busy", StatusCodes.TOO_MANY_REQUESTS, "VoteHotKeyBusy"],
			["internal", StatusCodes.INTERNAL_SERVER_ERROR, "InternalError"],
			["thirdParty", StatusCodes.INTERNAL_SERVER_ERROR, "InternalError"],
		] as const;

		for (const [path, expectedStatus, expectedCode] of expected) {
			const response = await app.handle(new Request(`http://localhost/${path}`));
			const requestId = response.headers.get("X-Request-Id");
			expect(response.status).toBe(expectedStatus);
			expect(requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
			const body = (await response.json()) as {
				error: { code: string; message: string; details?: unknown };
				requestId: string;
			};
			expect(body.requestId).toBe(requestId);
			expect(body.error.code).toBe(expectedCode);
			expect(JSON.stringify(body)).not.toContain("private");
			if (path === "busy") expect(response.headers.get("Retry-After")).toBe("1");
			else expect(response.headers.get("Retry-After")).toBeNull();
		}
	});

	it("serializes typed failures without exposing their cause", () => {
		const failure = new UnitPermissionForbidden("unit.update", ["title"]);

		expect(failure).toBeInstanceOf(Error);
		expect(failure.type).toBe("UnitPermissionForbidden");
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

		const busy = new VoteHotKeyBusy(new Error("database diagnostic"));
		expect(busy.status).toBe(StatusCodes.TOO_MANY_REQUESTS);
		expect(apiErrorRetryAfterSeconds(busy)).toBe(1);
		expect(toApiErrorBody(busy, "request-3")).toEqual({
			error: {
				code: "VoteHotKeyBusy",
				message: "The vote target is busy; retry shortly",
			},
			requestId: "request-3",
		});
	});

	it("keeps the public error registry unique and discriminated", () => {
		expect(ApiErrorCodes).toHaveLength(ApiErrors.length);
		expect(new Set(ApiErrorCodes)).toHaveLength(ApiErrorCodes.length);
		expect([...ApiErrorRegistry.keys()]).toEqual(ApiErrorCodes);
		expect([...ApiErrorRegistry.values()]).toEqual([...ApiErrors]);
		expect(ApiErrorCodes.every((code) => /^[A-Z][A-Za-z0-9]*$/.test(code))).toBe(true);
		expect(ApiErrorCodes.every(isApiErrorCode)).toBe(true);
		expect(isApiErrorCode("NOT_REGISTERED")).toBe(false);
		expect(isApiError({ type: "UnitChanged", status: StatusCodes.CONFLICT })).toBe(false);
	});

	it("preserves payload fields that Effect previously populated through super", () => {
		const contentLabel = new ContentLabelApplicationInvalid("private_scope");
		expect(contentLabel).toMatchObject({
			type: "ContentLabelApplicationInvalid",
			reason: "private_scope",
			details: { reason: "private_scope" },
		});

		const dock = new DockRevisionConflict("019f995d-7595-7c99-9183-250790bbfe2f");
		expect(dock).toMatchObject({
			type: "DockRevisionConflict",
			latestRevisionId: "019f995d-7595-7c99-9183-250790bbfe2f",
			details: { latestRevisionId: "019f995d-7595-7c99-9183-250790bbfe2f" },
		});

		const measurement = new UnitMergeMeasurementConflict({
			reason: "context_limit",
			contextualCount: 17,
		});
		expect(measurement).toMatchObject({
			type: "UnitMergeMeasurementConflict",
			reason: "context_limit",
			contextualCount: 17,
			details: { reason: "context_limit", contextualCount: 17 },
		});
	});
});
