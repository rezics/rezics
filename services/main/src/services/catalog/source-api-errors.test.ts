import { StatusCodes } from "http-status-codes";
import Elysia, { HTTPError } from "elysia";
import { describe, expect, it } from "vitest";

import { enterAuditRequestContext } from "../audit";
import errorBoundary from "../api/error-boundary";
import {
	ApiErrorRegistry,
	isApiError,
	toApiErrorBody,
	ValidationError,
} from "../api/errors";
import { CatalogRevisionConflict } from "./storage";
import { CatalogSourceRequestLimited, CatalogSourceUnavailable, isCatalogSourceAdmissionExhausted } from "./source-api-errors";

const mappingProtocolMessage = "Source mapping protocol requires an explicit binding revision";

describe("catalog source API error registry", () => {
	it("recognizes only operational admission backpressure through wrapped database errors",()=>{
		expect(isCatalogSourceAdmissionExhausted(new Error("query failed",{cause:{code:"53000",message:"operational admission exhausted for bucket 277, lane event-outbox"}}))).toBe(true);
		expect(isCatalogSourceAdmissionExhausted({code:"53000",message:"unrelated storage exhaustion"})).toBe(false);
		expect(isCatalogSourceAdmissionExhausted({code:"23514",message:"operational admission exhausted for bucket 277, lane event-outbox"})).toBe(false);
		const cyclic:{cause?:unknown}={};cyclic.cause=cyclic;
		expect(isCatalogSourceAdmissionExhausted(cyclic)).toBe(false);
	});
	it("registers source 429/503 classes and the existing binding 409", () => {
		const limited = new CatalogSourceRequestLimited();
		const unavailable = new CatalogSourceUnavailable();
		const stale = new CatalogRevisionConflict("Source binding revision is stale");

		expect(limited.status).toBe(StatusCodes.TOO_MANY_REQUESTS);
		expect(limited.type).toBe("CatalogSourceRequestLimited");
		expect(unavailable.status).toBe(StatusCodes.SERVICE_UNAVAILABLE);
		expect(unavailable.type).toBe("CatalogSourceUnavailable");
		expect(stale.status).toBe(StatusCodes.CONFLICT);
		expect(stale.type).toBe("CatalogRevisionConflict");
		expect(stale.message).toBe("Source binding revision is stale");

		expect(isApiError(limited)).toBe(true);
		expect(isApiError(unavailable)).toBe(true);
		expect(isApiError(stale)).toBe(true);
		expect(ApiErrorRegistry.get("CatalogSourceRequestLimited")).toBe(CatalogSourceRequestLimited);
		expect(ApiErrorRegistry.get("CatalogSourceUnavailable")).toBe(CatalogSourceUnavailable);
		expect(ApiErrorRegistry.get("CatalogRevisionConflict")).toBe(CatalogRevisionConflict);
		expect("retryAfterSeconds" in limited).toBe(false);
	});

	it("maps the mapping-protocol TypeError to ValidationError 422", () => {
		const cause = new TypeError(mappingProtocolMessage);
		expect(isApiError(cause)).toBe(false);
		expect(cause).toBeInstanceOf(TypeError);
		const mapped = new ValidationError({ message: cause.message.slice(0, 512) });
		expect(isApiError(mapped)).toBe(true);
		expect(mapped.status).toBe(StatusCodes.UNPROCESSABLE_ENTITY);
		expect(mapped.type).toBe("ValidationError");
		expect(toApiErrorBody(mapped, "request-1")).toEqual({
			error: {
				code: "ValidationError",
				message: "Request validation failed",
				details: { message: mappingProtocolMessage },
			},
			requestId: "request-1",
		});
	});

	it("returns declared statuses through the global error boundary without inventing Retry-After", async () => {
		class UnregisteredSourceFailure extends HTTPError.id("UnregisteredSourceFailure", 429) {
			override readonly message = "private unregistered source diagnostic";
		}
		const failures = {
			limited: new CatalogSourceRequestLimited(),
			unavailable: new CatalogSourceUnavailable(),
			stale: new CatalogRevisionConflict("Source binding revision is stale"),
			mappingProtocol: new ValidationError({ message: mappingProtocolMessage }),
			unregistered: new UnregisteredSourceFailure(),
			unmappedTypeError: new TypeError(mappingProtocolMessage),
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
			["limited", StatusCodes.TOO_MANY_REQUESTS, "CatalogSourceRequestLimited"],
			["unavailable", StatusCodes.SERVICE_UNAVAILABLE, "CatalogSourceUnavailable"],
			["stale", StatusCodes.CONFLICT, "CatalogRevisionConflict"],
			["mappingProtocol", StatusCodes.UNPROCESSABLE_ENTITY, "ValidationError"],
			["unregistered", StatusCodes.INTERNAL_SERVER_ERROR, "InternalError"],
			["unmappedTypeError", StatusCodes.INTERNAL_SERVER_ERROR, "InternalError"],
		] as const;

		for (const [path, expectedStatus, expectedCode] of expected) {
			const response = await app.handle(new Request(`http://localhost/${path}`));
			expect(response.status).toBe(expectedStatus);
			expect(response.headers.get("Retry-After")).toBeNull();
			const body = (await response.json()) as {
				error: { code: string; message: string };
				requestId: string;
			};
			expect(body.error.code).toBe(expectedCode);
			expect(JSON.stringify(body)).not.toContain("private");
		}
	});
});
