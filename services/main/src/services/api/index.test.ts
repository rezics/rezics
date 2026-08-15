import { StatusCodes } from "http-status-codes";
import { toOpenAPISchema } from "@elysiajs/openapi";
import { z } from "zod";
import { describe, expect, it } from "vitest";

import { UnitKindValues } from "../database/schema/contract-values";
import api from ".";

const ErrorBody = z.object({
	error: z.object({ code: z.string(), message: z.string() }),
	requestId: z.uuid(),
});

async function readErrorBody(response: Response) {
	return ErrorBody.parse(await response.json());
}

describe("API root", () => {
	it("serves the versioned agent contribution guide", async () => {
		const response = await api.handle(
			new Request("http://localhost/.well-known/rezics-agent.json"),
		);
		expect(response.status).toBe(StatusCodes.OK);
		expect(response.headers.get("Cache-Control")).toBe("public, max-age=300");
		expect(await response.json()).toMatchObject({
			version: "1",
			contribution: {
				requestField: "revisionContext.contribution",
				assurance: "server_derived",
			},
			workflow: {
				entitySearchKind: "software_agent",
				noModelVersionField: true,
			},
		});
	});

	it("serves health checks without dependencies", async () => {
		const get = await api.handle(new Request("http://localhost/api/v1/health"));
		const head = await api.handle(
			new Request("http://localhost/api/v1/health", { method: "HEAD" }),
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
			new Request("http://localhost/api/v1/users/me", { headers }),
		);
		const validation = await api.handle(
			new Request("http://localhost/api/v1/units/book?limit=0", { headers }),
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
		["POST", "/api/v1/polls/00000000-0000-7000-8000-000000000001/close"],
		["PUT", "/api/v1/users/me/following/00000000-0000-7000-8000-000000000001"],
		["DELETE", "/api/v1/users/me/following/00000000-0000-7000-8000-000000000001"],
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
			new Request("http://localhost/api/v1/users/me/preferences", {
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
			new Request("http://localhost/api/v1/api-tokens", {
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

		expect(document.paths["/api/v1/units/{type}"]?.post?.security).toEqual([
			{ ApiToken: [] },
			{ SessionCookie: [] },
		]);
		expect(document.paths["/api/v1/api-tokens"]?.get?.security).toEqual([{ SessionCookie: [] }]);
		expect(
			document.paths["/api/v1/api-tokens"]?.get?.responses?.[StatusCodes.FORBIDDEN],
		).toBeUndefined();
		expect(
			document.paths["/api/v1/api-tokens"]?.post?.responses?.[StatusCodes.FORBIDDEN],
		).toBeDefined();
		expect(document.paths["/api/v1/token"]?.get?.security).toEqual([{ ApiToken: [] }]);
		expect(document.paths["/api/v1/users/me/profile-slug"]?.put?.security).toEqual([
			{ SessionCookie: [] },
		]);
		expect(document.paths["/api/v1/slug-addresses/profile"]).toBeUndefined();
	});

	it("allows API-token credentials on Unit reference proposal and vote routes", () => {
		const document = toOpenAPISchema(api);
		const operations = [
			document.paths["/api/v1/units/{type}/{unitId}/aliases"]?.post,
			document.paths["/api/v1/units/{type}/{unitId}/aliases/{aliasId}/vote"]?.put,
			document.paths["/api/v1/units/{type}/{unitId}/aliases/{aliasId}/vote"]?.delete,
			document.paths["/api/v1/units/{type}/{unitId}/external-links"]?.post,
			document.paths["/api/v1/units/{type}/{unitId}/external-links/{externalLinkId}/vote"]?.put,
			document.paths["/api/v1/units/{type}/{unitId}/external-links/{externalLinkId}/vote"]?.delete,
		];

		for (const operation of operations) {
			expect(operation?.security).toEqual([{ ApiToken: [] }, { SessionCookie: [] }]);
		}
	});

	it("documents external-link references for every registered Unit kind", () => {
		const document = toOpenAPISchema(api);
		const operations = [
			document.paths["/api/v1/units/{type}/{unitId}/external-links"]?.get,
			document.paths["/api/v1/units/{type}/{unitId}/external-links"]?.post,
			document.paths["/api/v1/units/{type}/{unitId}/external-links/{externalLinkId}"]?.patch,
			document.paths["/api/v1/units/{type}/{unitId}/external-links/{externalLinkId}"]?.delete,
			document.paths["/api/v1/units/{type}/{unitId}/external-links/{externalLinkId}/vote"]?.put,
			document.paths["/api/v1/units/{type}/{unitId}/external-links/{externalLinkId}/vote"]?.delete,
		];

		for (const operation of operations) {
			if (!operation) throw new Error("Expected a Unit external-link operation");
			const typeParameter = operation.parameters?.find(
				(parameter) =>
					!("$ref" in parameter) && parameter.in === "path" && parameter.name === "type",
			);
			if (!typeParameter || "$ref" in typeParameter || !typeParameter.schema)
				throw new Error("Expected an inline Unit type path parameter");
			if ("$ref" in typeParameter.schema) throw new Error("Expected an inline Unit type schema");
			expect(typeParameter.schema.enum).toEqual(UnitKindValues);
		}

		const postResponses =
			document.paths["/api/v1/units/{type}/{unitId}/external-links"]?.post?.responses;
		expect(JSON.stringify(postResponses?.[StatusCodes.NOT_FOUND])).toContain("EntityEntryNotFound");
		expect(document.paths["/api/v1/units/{type}/{unitId}/aliases/{aliasId}"]?.delete).toBeDefined();
	});

	it("documents the development preview gate on unreleased Zone address writes", () => {
		const document = toOpenAPISchema(api);
		const methods = ["delete", "get", "patch", "post", "put"] as const;
		const previewProtectedZoneOperations = Object.entries(document.paths).flatMap(([path, item]) =>
			path.includes("/zones")
				? methods.flatMap((method) => {
						const forbidden = item?.[method]?.responses?.[StatusCodes.FORBIDDEN];
						return forbidden && JSON.stringify(forbidden).includes("PlatformCapabilityRequired")
							? [`${method.toUpperCase()} ${path}`]
							: [];
					})
				: [],
		);

		expect(previewProtectedZoneOperations.toSorted()).toEqual([
			"POST /api/v1/zones",
			"POST /api/v1/zones/{zoneId}/pages",
			"PUT /api/v1/zones/{zoneId}/pages/{pageId}",
			"PUT /api/v1/zones/{zoneId}/slug-address",
		]);
	});

	it("documents the development preview gate on non-Profile slug control planes", () => {
		const document = toOpenAPISchema(api);
		const expected = [
			["get", "/api/v1/slug-addresses/units/{unitId}"],
			["put", "/api/v1/slug-addresses/units/{unitId}"],
			["post", "/api/v1/slug-addresses/namespaces"],
			["delete", "/api/v1/slug-addresses/redirects/{redirectAddressId}"],
			["put", "/api/v1/realms/{realmId}/slug-address"],
		] as const;

		for (const [method, path] of expected) {
			const forbidden = document.paths[path]?.[method]?.responses?.[StatusCodes.FORBIDDEN];
			expect(JSON.stringify(forbidden)).toContain("PlatformCapabilityRequired");
		}
	});

	it("rejects API tokens before the first-party Profile slug handler", async () => {
		const response = await api.handle(
			new Request("http://localhost/api/v1/users/me/profile-slug", {
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
			new Request("http://localhost/api/v1/tags/00000000-0000-7000-8000-000000000001/hierarchy"),
		);

		expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
		expect((await readErrorBody(response)).error).toEqual({
			code: "AuthenticationRequired",
			message: "Authentication required",
		});
	});

	it("requires authentication before checking the Wiki navigation preview capability", async () => {
		const response = await api.handle(
			new Request(
				"http://localhost/api/v1/realms/00000000-0000-7000-8000-000000000001/wiki/navigation",
			),
		);

		expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
		expect((await readErrorBody(response)).error).toEqual({
			code: "AuthenticationRequired",
			message: "Authentication required",
		});
	});

	it("documents the development preview gate on every Wiki navigation operation", () => {
		const document = toOpenAPISchema(api);
		const expected = [
			["get", "/api/v1/realms/{realmId}/wiki/navigation"],
			["post", "/api/v1/realms/{realmId}/wiki/navigation"],
			["get", "/api/v1/realms/{realmId}/wiki/navigation/{navigationId}"],
			["put", "/api/v1/realms/{realmId}/wiki/navigation/{navigationId}"],
			["delete", "/api/v1/realms/{realmId}/wiki/navigation/{navigationId}"],
		] as const;

		for (const [method, path] of expected) {
			const operation = document.paths[path]?.[method];
			expect(JSON.stringify(operation?.responses?.[StatusCodes.FORBIDDEN])).toContain(
				"PlatformCapabilityRequired",
			);
			expect(operation?.description).toContain("Development preview");
		}
	});

	it("documents the development preview gate on every dedicated Tag-path operation", () => {
		const document = toOpenAPISchema(api);
		const methods = ["delete", "get", "post", "put"] as const;
		const previewProtectedOperations = Object.entries(document.paths).flatMap(([path, item]) =>
			path === "/api/v1/tags/{tagId}/hierarchy" ||
			path.startsWith("/api/v1/tag-structures") ||
			path.includes("/tag-structures/")
				? methods.flatMap((method) => {
						const forbidden = item?.[method]?.responses?.[StatusCodes.FORBIDDEN];
						return forbidden && JSON.stringify(forbidden).includes("PlatformCapabilityRequired")
							? [`${method.toUpperCase()} ${path}`]
							: [];
					})
				: [],
		);

		expect(previewProtectedOperations).toEqual([
			"GET /api/v1/tags/{tagId}/hierarchy",
			"POST /api/v1/tag-structures",
			"GET /api/v1/tag-structures/{structureId}",
			"PUT /api/v1/tag-structures/{structureId}",
			"DELETE /api/v1/tag-structures/{structureId}/vote",
			"PUT /api/v1/tag-structures/{structureId}/vote",
			"DELETE /api/v1/units/{type}/{unitId}/tag-structures/{structureId}",
			"PUT /api/v1/units/{type}/{unitId}/tag-structures/{structureId}",
			"DELETE /api/v1/units/{type}/{unitId}/tag-structures/{structureId}/vote",
			"PUT /api/v1/units/{type}/{unitId}/tag-structures/{structureId}/vote",
		]);
	});

	it("requires authentication before checking the Tag-path search preview capability", async () => {
		const response = await api.handle(
			new Request("http://localhost/api/v1/search/tag-structures", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ localizationLanguages: ["en"] }),
			}),
		);

		expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
		expect((await readErrorBody(response)).error.code).toBe("AuthenticationRequired");
	});

	it("documents untracked progress as a successful state", () => {
		const document = toOpenAPISchema(api);
		const responses = document.paths["/api/v1/progress/{unitId}"]?.get?.responses;
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

		expect(document.paths["/api/v1/users/me/following/{unitId}"]?.put?.requestBody).toBeUndefined();
		const preferencesBody = document.paths["/api/v1/users/me/preferences"]?.put?.requestBody;
		if (!preferencesBody || "$ref" in preferencesBody)
			throw new Error("Expected an inline preferences request body");
		expect(Object.keys(preferencesBody.content)).toEqual(["application/json"]);
	});
});
