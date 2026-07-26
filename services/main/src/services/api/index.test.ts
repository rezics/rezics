import { StatusCodes } from "http-status-codes";
import { toOpenAPISchema } from "@elysiajs/openapi";
import { z } from "zod";
import { describe, expect, it } from "vitest";

import api from ".";

const ErrorBody = z.object({
	error: z.object({ code: z.string(), message: z.string() }),
	requestId: z.uuid(),
});

async function readErrorBody(response: Response) {
	return ErrorBody.parse(await response.json());
}

describe("API root", () => {
	it("serves health checks without dependencies", async () => {
		const get = await api.handle(new Request("http://localhost/api/health"));
		const head = await api.handle(
			new Request("http://localhost/api/health", { method: "HEAD" }),
		);

		expect(get.status).toBe(StatusCodes.OK);
		expect(await get.json()).toEqual({ status: "ok" });
		expect(head.status).toBe(StatusCodes.NO_CONTENT);
		expect(await head.text()).toBe("");
	});

	it("maps authentication and validation failures to the public error contract", async () => {
		const headers = {
			"Accept-Language": "zh-CN",
			"X-Request-Id": "caller-controlled",
		};
		const unauthorized = await api.handle(
			new Request("http://localhost/api/users/me", { headers }),
		);
		const validation = await api.handle(
			new Request("http://localhost/api/units/book?limit=0", { headers }),
		);

		expect(unauthorized.status).toBe(StatusCodes.UNAUTHORIZED);
		expect(unauthorized.headers.has("X-Request-Id")).toBe(false);
		expect(unauthorized.headers.has("Content-Language")).toBe(false);
		expect((await readErrorBody(unauthorized)).error).toEqual({
			code: "AuthenticationRequired",
			message: "Authentication required",
		});

		expect(validation.status).toBe(StatusCodes.UNPROCESSABLE_ENTITY);
		expect(validation.headers.has("X-Request-Id")).toBe(false);
		expect((await readErrorBody(validation)).error).toEqual({
			code: "ValidationError",
			message: "Request validation failed",
		});
	});

	it.each([
		["POST", "/api/polls/00000000-0000-7000-8000-000000000001/close"],
		["PUT", "/api/users/me/following/00000000-0000-7000-8000-000000000001"],
		["DELETE", "/api/users/me/following/00000000-0000-7000-8000-000000000001"],
	] as const)("does not parse a bodyless %s request as JSON", async (method, path) => {
		const response = await api.handle(new Request(`http://localhost${path}`, { method }));

		expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
		expect((await readErrorBody(response)).error).toEqual({
			code: "AuthenticationRequired",
			message: "Authentication required",
		});
	});

	it("maps malformed request bodies to the public client-error contract", async () => {
		const response = await api.handle(
			new Request("http://localhost/api/users/me/preferences", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: "{",
			}),
		);

		expect(response.status).toBe(StatusCodes.BAD_REQUEST);
		expect((await readErrorBody(response)).error).toEqual({
			code: "MalformedRequestBody",
			message: "Request body is malformed",
		});
	});

	it("preserves unmatched routes as not found", async () => {
		const response = await api.handle(new Request("http://localhost/__test/unknown"));

		expect(response.status).toBe(StatusCodes.NOT_FOUND);
	});

	it("never accepts API tokens on the credential control-plane", async () => {
		const response = await api.handle(
			new Request("http://localhost/api/api-tokens", {
				headers: { Authorization: "Bearer rz_api_test_credential" },
			}),
		);

		expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
		expect((await readErrorBody(response)).error).toEqual({
			code: "InteractiveSessionRequired",
			message: "An interactive session is required",
		});
	});

	it("derives OpenAPI credential requirements from the access guard", () => {
		const document = toOpenAPISchema(api);

		expect(document.paths["/api/units/{type}"]?.post?.security).toEqual([
			{ ApiToken: [] },
			{ SessionCookie: [] },
		]);
		expect(document.paths["/api/api-tokens"]?.get?.security).toEqual([{ SessionCookie: [] }]);
		expect(document.paths["/api/token"]?.get?.security).toEqual([{ ApiToken: [] }]);
	});

	it("documents untracked progress as a successful state", () => {
		const document = toOpenAPISchema(api);
		const responses = document.paths["/api/progress/{unitId}"]?.get?.responses;
		if (!responses) throw new Error("Expected progress lookup responses");

		const success = JSON.stringify(responses[StatusCodes.OK]);
		const notFound = JSON.stringify(responses[StatusCodes.NOT_FOUND]);

		expect(success).toContain('"untracked"');
		expect(success).toContain('"tracked"');
		expect(notFound).toContain("UnitNotFound");
		expect(notFound).not.toContain("ProgressNotFound");
	});

	it("documents JSON only for routes that declare a request body", () => {
		const document = toOpenAPISchema(api);

		expect(
			document.paths["/api/users/me/following/{unitId}"]?.put?.requestBody,
		).toBeUndefined();
		const preferencesBody = document.paths["/api/users/me/preferences"]?.put?.requestBody;
		if (!preferencesBody || "$ref" in preferencesBody)
			throw new Error("Expected an inline preferences request body");
		expect(Object.keys(preferencesBody.content)).toEqual(["application/json"]);
	});
});
