import { StatusCodes } from "http-status-codes";
import { OpenAPIV3 } from "openapi-types";
import { z } from "zod";
import { describe, expect, it } from "vitest";

import { UnitKindValues } from "../database/schema/contract-values";
import api from ".";
import { toRezicsOpenApiSchema as toOpenAPISchema } from "./openapi";

const ErrorBody = z.object({
	error: z.object({ code: z.string(), message: z.string() }),
	requestId: z.uuid(),
});

async function readErrorBody(response: Response) {
	return ErrorBody.parse(await response.json());
}

describe("API root", () => {
	it("preserves the credentialed CORS contract for actual and preflight requests", async () => {
		const trustedOrigin = "http://localhost:3000";
		const allowedMethods = "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS";
		const allowedHeaders = "Content-Type, Authorization, Accept-Language";
		const exposedHeaders = "X-Request-Id, Retry-After";
		const actual = await api.handle(
			new Request("http://localhost/api/v1/health", {
				headers: { Cookie: "test=value", Origin: trustedOrigin },
			}),
		);
		const preflight = await api.handle(
			new Request("http://localhost/api/v1/users/me/preferences", {
				method: "OPTIONS",
				headers: {
					Origin: trustedOrigin,
					"Access-Control-Request-Method": "PUT",
					"Access-Control-Request-Headers": "content-type, authorization",
				},
			}),
		);
		const untrusted = await api.handle(
			new Request("http://localhost/api/v1/health", {
				headers: { Origin: "https://untrusted.example" },
			}),
		);

		expect(actual.status).toBe(StatusCodes.OK);
		expect(actual.headers.get("Access-Control-Allow-Origin")).toBe(trustedOrigin);
		expect(actual.headers.get("Access-Control-Allow-Credentials")).toBe("true");
		expect(actual.headers.get("Access-Control-Allow-Methods")).toBe(allowedMethods);
		expect(actual.headers.get("Access-Control-Allow-Headers")).toBe(allowedHeaders);
		expect(actual.headers.get("Access-Control-Expose-Headers")).toBe(exposedHeaders);
		expect(actual.headers.get("Access-Control-Max-Age")).toBeNull();
		expect(actual.headers.get("Vary")).toBe("Origin");

		expect(preflight.status).toBe(StatusCodes.NO_CONTENT);
		expect(preflight.headers.get("Access-Control-Allow-Origin")).toBe(trustedOrigin);
		expect(preflight.headers.get("Access-Control-Allow-Credentials")).toBe("true");
		expect(preflight.headers.get("Access-Control-Allow-Methods")).toBe(allowedMethods);
		expect(preflight.headers.get("Access-Control-Allow-Headers")).toBe(allowedHeaders);
		expect(preflight.headers.get("Access-Control-Expose-Headers")).toBe(exposedHeaders);
		expect(preflight.headers.get("Access-Control-Max-Age")).toBe("5");
		expect(preflight.headers.get("Vary")).toBe("Origin");

		expect(untrusted.status).toBe(StatusCodes.OK);
		expect(untrusted.headers.get("Access-Control-Allow-Origin")).toBeNull();
		expect(untrusted.headers.get("Access-Control-Allow-Credentials")).toBe("true");
		expect(untrusted.headers.get("Vary")).toBe("Origin");
	});

	it("mounts Better Auth before business routes and preserves its response contract", async () => {
		const health = await api.handle(new Request("http://localhost/api/auth/ok"));
		const session = await api.handle(new Request("http://localhost/api/auth/get-session"));
		const invalidSignIn = await api.handle(
			new Request("http://localhost/api/auth/sign-in/email", {
				method: "POST",
				headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
				body: JSON.stringify({ email: "not-an-email", password: "test-password" }),
			}),
		);
		const rejectedOrigin = await api.handle(
			new Request("http://localhost/api/auth/sign-in/email", {
				method: "POST",
				headers: { "Content-Type": "application/json", Origin: "https://untrusted.example" },
				body: JSON.stringify({ email: "reader@example.com", password: "test-password" }),
			}),
		);
		const signOut = await api.handle(
			new Request("http://localhost/api/auth/sign-out", {
				method: "POST",
				headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
				body: "{}",
			}),
		);

		expect(health.status).toBe(StatusCodes.OK);
		expect(await health.json()).toEqual({ ok: true });
		expect(session.status).toBe(StatusCodes.OK);
		expect(session.headers.get("Cache-Control")).toBe("no-store");
		expect(await session.json()).toBeNull();
		expect(invalidSignIn.status).toBe(StatusCodes.BAD_REQUEST);
		expect(await invalidSignIn.json()).toMatchObject({ code: "INVALID_EMAIL" });
		expect(rejectedOrigin.status).toBe(StatusCodes.FORBIDDEN);
		expect(await rejectedOrigin.json()).toMatchObject({ code: "INVALID_ORIGIN" });
		expect(signOut.status).toBe(StatusCodes.OK);
		expect(await signOut.json()).toMatchObject({ success: true });
		expect(signOut.headers.get("Set-Cookie")).toContain("better-auth.session_token=");
		expect(signOut.headers.get("Set-Cookie")).toContain("Max-Age=0");
	});

	it.each([
		["POST", "/api/auth/api-key/create"],
		["GET", "/api/auth/api-key/get"],
		["GET", "/api/auth/api-key/list"],
		["POST", "/api/auth/api-key/update"],
		["POST", "/api/auth/api-key/delete"],
	] as const)(
		"keeps the Better Auth API-key %s %s route intentionally disabled",
		async (method, path) => {
			const response = await api.handle(
				new Request(`http://localhost${path}`, {
					method,
					headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
					...(method === "POST" ? { body: "{}" } : {}),
				}),
			);

			expect(response.status).toBe(StatusCodes.NOT_FOUND);
			expect(response.headers.get("Content-Type")).toContain("text/plain");
			expect(await response.text()).toBe("Not Found");
		},
	);

	it("rejects an invalid API-key bearer credential on an API-key-only route", async () => {
		const protectedRoute = await api.handle(
			new Request("http://localhost/api/v1/token", {
				headers: { Authorization: "Bearer invalid-api-token" },
			}),
		);

		expect(protectedRoute.status).toBe(StatusCodes.UNAUTHORIZED);
		expect((await readErrorBody(protectedRoute)).error).toEqual({
			code: "AuthenticationRequired",
			message: "Authentication required",
		});
	});

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

	it("documents an exact, session-only Unit governance lookup", () => {
		const operation = toOpenAPISchema(api).paths["/api/v1/governance/platform/units/{unitId}"]?.get;

		expect(operation?.security).toEqual([{ SessionCookie: [] }]);
		expect(operation?.responses?.[StatusCodes.FORBIDDEN]).toBeDefined();
		expect(operation?.responses?.[StatusCodes.NOT_FOUND]).toBeDefined();
	});

	it("requires an interactive session before loading a platform Unit", async () => {
		const response = await api.handle(
			new Request(
				"http://localhost/api/v1/governance/platform/units/0195c49b-8f3b-7e18-8c45-c2f36ee8d337",
			),
		);

		expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
		expect((await readErrorBody(response)).error.code).toBe("InteractiveSessionRequired");
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

	it("declares hot-key backpressure only on Vote-writing routes", () => {
		const document = toOpenAPISchema(api);
		const voteOperation = document.paths["/api/v1/units/{type}/{unitId}/tags/{tagId}/vote"]?.put;
		const unrelatedOperation =
			document.paths["/api/v1/units/{type}/{unitId}/aliases/{aliasId}/vote"]?.put;

		expect(voteOperation?.security).toEqual([{ ApiToken: [] }, { SessionCookie: [] }]);
		expect(unrelatedOperation?.security).toEqual([{ ApiToken: [] }, { SessionCookie: [] }]);
		expect(JSON.stringify(voteOperation?.responses?.[StatusCodes.TOO_MANY_REQUESTS])).toContain(
			"VoteHotKeyBusy",
		);
		expect(unrelatedOperation?.responses?.[StatusCodes.TOO_MANY_REQUESTS]).toBeUndefined();
	});

	it("documents final Tag policy failures without mutable Path corrections", () => {
		const document = toOpenAPISchema(api);
		const unitTag = document.paths["/api/v1/units/{type}/{unitId}/tags/{tagId}"];
		const unitTagVote = document.paths["/api/v1/units/{type}/{unitId}/tags/{tagId}/vote"];
		const realmTag = document.paths["/api/v1/realms/{realmId}/units/{unitId}/policy-tags/{tagId}"];
		const realmTagVote =
			document.paths["/api/v1/realms/{realmId}/units/{unitId}/tags/{tagId}/vote"];
		const realmTagContext = document.paths["/api/v1/realms/{realmId}/tags/{tagId}/context"];
		const unitMergeOperations = [
			document.paths["/api/v1/governance/platform/unit-merges/preflight"]?.post,
			document.paths["/api/v1/governance/platform/unit-merges"]?.post,
			document.paths["/api/v1/governance/platform/unit-merges/direct"]?.post,
			document.paths["/api/v1/governance/platform/unit-merges/{requestId}/reviews"]?.post,
		];

		expect(JSON.stringify(unitTag?.put?.responses?.[StatusCodes.UNPROCESSABLE_ENTITY])).toContain(
			"TagNotDirectlyApplicable",
		);
		expect(JSON.stringify(unitTag?.put?.responses?.[StatusCodes.UNPROCESSABLE_ENTITY])).toContain(
			"ContentLabelApplicationInvalid",
		);
		expect(JSON.stringify(unitTag?.put?.responses?.[StatusCodes.FORBIDDEN])).toContain(
			"ContentLabelPlatformApplyForbidden",
		);
		expect(JSON.stringify(unitTag?.patch?.responses?.[StatusCodes.CONFLICT])).toContain(
			"ContentLabelPlatformIdentityImmutable",
		);
		expect(JSON.stringify(unitTag?.delete?.responses?.[StatusCodes.FORBIDDEN])).toContain(
			"ContentLabelPlatformRemovalForbidden",
		);
		expect(JSON.stringify(unitTag?.delete?.responses?.[StatusCodes.CONFLICT])).toContain(
			"TagApplicationHasJudgments",
		);
		expect(JSON.stringify(realmTagContext?.delete?.responses?.[StatusCodes.CONFLICT])).toContain(
			"RealmTagContextInUse",
		);
		expect(
			JSON.stringify(unitTagVote?.put?.responses?.[StatusCodes.UNPROCESSABLE_ENTITY]),
		).toContain("ContentLabelJudgmentForbidden");
		expect(JSON.stringify(realmTag?.put?.responses?.[StatusCodes.UNPROCESSABLE_ENTITY])).toContain(
			"ContentLabelApplicationInvalid",
		);
		expect(
			JSON.stringify(realmTagVote?.put?.responses?.[StatusCodes.UNPROCESSABLE_ENTITY]),
		).toContain("ContentLabelJudgmentForbidden");

		for (const operation of unitMergeOperations) {
			expect(JSON.stringify(operation?.responses?.[StatusCodes.UNPROCESSABLE_ENTITY])).toContain(
				"ContentLabelUnitMergeForbidden",
			);
		}

		expect(document.paths["/api/v1/tag-paths/{pathId}"]?.put).toBeUndefined();
		expect(document.paths["/api/v1/tag-paths/{pathId}/corrections/{correctionId}"]).toBeUndefined();
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
				(parameter: OpenAPIV3.ParameterObject | OpenAPIV3.ReferenceObject) =>
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
		const methods = [
			OpenAPIV3.HttpMethods.DELETE,
			OpenAPIV3.HttpMethods.GET,
			OpenAPIV3.HttpMethods.PATCH,
			OpenAPIV3.HttpMethods.POST,
			OpenAPIV3.HttpMethods.PUT,
		] as const;
		const paths: OpenAPIV3.PathsObject = document.paths;
		const previewProtectedZoneOperations = Object.entries(paths).flatMap(([path, item]) =>
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
			"PATCH /api/v1/zones/{zoneId}",
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

	it("publishes Tag hierarchy as a public read", () => {
		const document = toOpenAPISchema(api);
		const operation = document.paths["/api/v1/tags/{tagId}/hierarchy"]?.get;
		expect(operation).toBeDefined();
		expect(operation?.security).toBeUndefined();
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

	it("publishes the final dedicated Tag Path contract without a preview gate", () => {
		const document = toOpenAPISchema(api);
		const finalOperations = [
			document.paths["/api/v1/tags/{tagId}/hierarchy"]?.get,
			document.paths["/api/v1/tags/{tagId}/expressions"]?.get,
			document.paths["/api/v1/tag-expressions"]?.post,
			document.paths["/api/v1/tag-expressions/{expressionId}/inference-rules"]?.post,
			document.paths["/api/v1/tag-paths"]?.post,
			document.paths["/api/v1/tag-paths/{pathId}"]?.get,
			document.paths["/api/v1/tag-paths/{pathId}/senses"]?.post,
			document.paths["/api/v1/tag-paths/{pathId}/senses/{senseId}"]?.delete,
			document.paths["/api/v1/tag-paths/{pathId}/vote"]?.put,
			document.paths["/api/v1/tag-paths/{pathId}/vote"]?.delete,
			document.paths["/api/v1/units/{type}/{unitId}/tag-path-applications"]?.post,
			document.paths["/api/v1/units/{type}/{unitId}/tag-path-applications/{applicationId}"]?.delete,
			document.paths["/api/v1/units/{type}/{unitId}/tag-path-applications/{applicationId}/judgment"]
				?.put,
			document.paths["/api/v1/units/{type}/{unitId}/tag-path-applications/{applicationId}/judgment"]
				?.delete,
		];

		for (const operation of finalOperations) {
			expect(operation).toBeDefined();
			expect(operation?.description ?? "").not.toContain("Development preview");
		}
		expect(Object.keys(document.paths)).not.toContain("/api/v1/tag-structures");
		expect(
			Object.keys(document.paths)
				.filter((path) => path.includes("tag-paths"))
				.some((path) => path.includes("{structureId}")),
		).toBe(false);
	});

	it("requires a session before searching Tag Paths for curation", async () => {
		const response = await api.handle(
			new Request("http://localhost/api/v1/tag-paths/search?q=hair&localizationLanguages=en"),
		);

		expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
		expect((await readErrorBody(response)).error.code).toBe("InteractiveSessionRequired");
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
