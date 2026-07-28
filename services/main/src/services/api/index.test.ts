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
		const unauthorizedRequestId = unauthorized.headers.get("X-Request-Id");
		expect(unauthorizedRequestId).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
		);
		expect(unauthorizedRequestId).not.toBe(headers["X-Request-Id"]);
		expect(unauthorized.headers.has("Content-Language")).toBe(false);
		const unauthorizedBody = await readErrorBody(unauthorized);
		expect(unauthorizedBody.requestId).toBe(unauthorizedRequestId);
		expect(unauthorizedBody.error).toEqual({
			code: "AuthenticationRequired",
			message: "Authentication required",
		});

		expect(validation.status).toBe(StatusCodes.UNPROCESSABLE_ENTITY);
		const validationRequestId = validation.headers.get("X-Request-Id");
		expect(validationRequestId).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
		);
		const validationBody = await readErrorBody(validation);
		expect(validationBody.requestId).toBe(validationRequestId);
		expect(validationBody.error).toEqual({
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
		expect(document.paths["/api/users/me/profile-slug"]?.put?.security).toEqual([
			{ SessionCookie: [] },
		]);
		expect(document.paths["/api/slug-addresses/profile"]).toBeUndefined();
	});

	it("documents the development preview gate on unreleased Zone address writes", () => {
		const document = toOpenAPISchema(api);
		const methods = ["delete", "get", "patch", "post", "put"] as const;
		const previewProtectedZoneOperations = Object.entries(document.paths).flatMap(
			([path, item]) =>
				path.includes("/zones")
					? methods.flatMap((method) => {
							const forbidden = item?.[method]?.responses?.[StatusCodes.FORBIDDEN];
							return forbidden &&
								JSON.stringify(forbidden).includes("PlatformCapabilityRequired")
								? [`${method.toUpperCase()} ${path}`]
								: [];
						})
					: [],
		);

		expect(previewProtectedZoneOperations.toSorted()).toEqual([
			"POST /api/zones",
			"POST /api/zones/{zoneId}/pages",
			"PUT /api/zones/{zoneId}/pages/{pageId}",
			"PUT /api/zones/{zoneId}/slug-address",
		]);
	});

	it("documents the development preview gate on non-Profile slug control planes", () => {
		const document = toOpenAPISchema(api);
		const expected = [
			["get", "/api/slug-addresses/units/{unitId}"],
			["put", "/api/slug-addresses/units/{unitId}"],
			["post", "/api/slug-addresses/namespaces"],
			["delete", "/api/slug-addresses/redirects/{redirectAddressId}"],
			["put", "/api/realms/{realmId}/slug-address"],
		] as const;

		for (const [method, path] of expected) {
			const forbidden = document.paths[path]?.[method]?.responses?.[StatusCodes.FORBIDDEN];
			expect(JSON.stringify(forbidden)).toContain("PlatformCapabilityRequired");
		}
	});

	it("rejects API tokens before the first-party Profile slug handler", async () => {
		const response = await api.handle(
			new Request("http://localhost/api/users/me/profile-slug", {
				method: "PUT",
				headers: {
					Authorization: "Bearer rz_api_test_credential",
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ slug: "alice" }),
			}),
		);

		expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
		expect((await readErrorBody(response)).error).toEqual({
			code: "InteractiveSessionRequired",
			message: "An interactive session is required",
		});
	});

	it("requires authentication before checking the Tag hierarchy preview capability", async () => {
		const response = await api.handle(
			new Request("http://localhost/api/tags/00000000-0000-7000-8000-000000000001"),
		);

		expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
		expect((await readErrorBody(response)).error).toEqual({
			code: "AuthenticationRequired",
			message: "Authentication required",
		});
	});

	it("documents the development preview gate on every dedicated Tag-path operation", () => {
		const document = toOpenAPISchema(api);
		const methods = ["delete", "get", "post", "put"] as const;
		const previewProtectedOperations = Object.entries(document.paths).flatMap(([path, item]) =>
			path === "/api/tags/{tagId}" ||
			path.startsWith("/api/tag-structures") ||
			path.includes("/tag-structures/")
				? methods.flatMap((method) => {
						const forbidden = item?.[method]?.responses?.[StatusCodes.FORBIDDEN];
						return forbidden &&
							JSON.stringify(forbidden).includes("PlatformCapabilityRequired")
							? [`${method.toUpperCase()} ${path}`]
							: [];
					})
				: [],
		);

		expect(previewProtectedOperations).toEqual([
			"GET /api/tags/{tagId}",
			"POST /api/tag-structures",
			"GET /api/tag-structures/{structureId}",
			"PUT /api/tag-structures/{structureId}",
			"DELETE /api/tag-structures/{structureId}/vote",
			"PUT /api/tag-structures/{structureId}/vote",
			"DELETE /api/units/{type}/{unitId}/tag-structures/{structureId}",
			"PUT /api/units/{type}/{unitId}/tag-structures/{structureId}",
			"DELETE /api/units/{type}/{unitId}/tag-structures/{structureId}/vote",
			"PUT /api/units/{type}/{unitId}/tag-structures/{structureId}/vote",
		]);
	});

	it("requires authentication before checking the Tag-path search preview capability", async () => {
		const response = await api.handle(
			new Request("http://localhost/api/search/tag-structures", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: "{}",
			}),
		);

		expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
		expect((await readErrorBody(response)).error.code).toBe("AuthenticationRequired");
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
