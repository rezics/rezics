import { StatusCodes } from "http-status-codes";
process.env.DATABASE_URL ??= "postgres://openapi:openapi@localhost/openapi";

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { OpenAPIV3 } from "openapi-types";

import { ApiErrorCodes } from "../src/services/api/errors";
import {
	apiRouteOperationId,
	resolveApiQuotaOperation,
} from "../src/services/auth/api-quota/operation";
import { RezicsVersion } from "../src/version";
import { toRezicsOpenApiSchema } from "../src/services/api/openapi";
import { formatWithBiome } from "./format-with-biome";
import { ApiQuotaExceededResponse, decorateRetryableResponse } from "./openapi-retryable-response";

const { initializeObservability } = await import("@rezics/observability");
const observability = initializeObservability({
	service: { name: "rezics-openapi-generator", version: RezicsVersion, environment: "tooling" },
});
const { default: api } = await import("../src/services/api");

const document = {
	openapi: "3.2.0",
	info: {
		title: "REZICS API",
		version: RezicsVersion,
	},
	...toRezicsOpenApiSchema(api),
};

const methods = [
	OpenAPIV3.HttpMethods.GET,
	OpenAPIV3.HttpMethods.POST,
	OpenAPIV3.HttpMethods.PUT,
	OpenAPIV3.HttpMethods.PATCH,
	OpenAPIV3.HttpMethods.DELETE,
	OpenAPIV3.HttpMethods.HEAD,
] as const;
const validationErrorResponse = {
	description: "Request validation failed",
	content: {
		"application/json": { schema: { $ref: "#/components/schemas/ValidationError" } },
	},
};
const malformedRequestBodyResponse = {
	description: "Request body could not be parsed",
	content: {
		"application/json": { schema: { $ref: "#/components/schemas/MalformedRequestBody" } },
	},
};
const internalErrorResponse = {
	description: "Unexpected internal failure",
	content: {
		"application/json": { schema: { $ref: "#/components/schemas/InternalError" } },
	},
};
const isResponseObject = (
	response: OpenAPIV3.ReferenceObject | OpenAPIV3.ResponseObject | undefined,
): response is OpenAPIV3.ResponseObject => Boolean(response && !("$ref" in response));

function containsJsonValue(value: unknown, target: string): boolean {
	if (value === target) return true;
	if (Array.isArray(value)) return value.some((item) => containsJsonValue(item, target));
	if (typeof value !== "object" || value === null) return false;
	return Object.values(value).some((item) => containsJsonValue(item, target));
}

document.components ??= { schemas: {} };
document.components.schemas ??= {};
Object.assign(document.components, {
	securitySchemes: {
		ApiToken: {
			type: "http",
			scheme: "bearer",
			bearerFormat: "REZICS API token",
			description: "Use Authorization: Bearer rz_api_<token>. Never put tokens in URLs.",
		},
		SessionCookie: {
			type: "apiKey",
			in: "cookie",
			name: "better-auth.session_token",
			description: "Interactive browser session used by the REZICS first-party application.",
		},
	} satisfies OpenAPIV3.ComponentsObject["securitySchemes"],
});
document.components.schemas.ApiErrorCode = {
	type: "string",
	enum: [...ApiErrorCodes],
};
document.components.schemas.MalformedRequestBody = {
	type: "object",
	required: ["error", "requestId"],
	properties: {
		error: {
			type: "object",
			required: ["code", "message"],
			properties: {
				code: { type: "string", enum: ["MalformedRequestBody"] },
				message: { type: "string" },
			},
		},
		requestId: { type: "string" },
	},
};
document.components.schemas.ValidationError = {
	type: "object",
	required: ["error", "requestId"],
	properties: {
		error: {
			type: "object",
			required: ["code", "message"],
			properties: {
				code: { type: "string", enum: ["ValidationError"] },
				message: { type: "string" },
				details: { $ref: "#/components/schemas/JsonValue" },
			},
		},
		requestId: { type: "string" },
	},
};
document.components.schemas.InternalError = {
	type: "object",
	required: ["error", "requestId"],
	properties: {
		error: {
			type: "object",
			required: ["code", "message"],
			properties: {
				code: { type: "string", enum: ["InternalError"] },
				message: { type: "string" },
			},
		},
		requestId: { type: "string" },
	},
};

function normalizeComponentReferences(value: unknown, componentNames: ReadonlySet<string>): void {
	if (Array.isArray(value)) {
		for (const item of value) normalizeComponentReferences(item, componentNames);
		return;
	}
	if (typeof value !== "object" || value === null) return;
	const record = value as Record<string, unknown>;
	if (
		typeof record.$ref === "string" &&
		!record.$ref.startsWith("#/") &&
		componentNames.has(record.$ref)
	)
		record.$ref = `#/components/schemas/${record.$ref}`;
	for (const child of Object.values(record)) normalizeComponentReferences(child, componentNames);
}

// TypeBox references models by their local $id. OpenAPI references must use a
// component URI so downstream generators preserve recursive types instead of
// degrading them to `unknown`.
normalizeComponentReferences(document, new Set(Object.keys(document.components.schemas)));

const paths: OpenAPIV3.PathsObject = document.paths;
for (const [pathTemplate, path] of Object.entries(paths)) {
	if (!path) continue;
	for (const method of methods) {
		const operation = path[method];
		if (!operation) continue;
		const routeOperationId = apiRouteOperationId(
			method,
			pathTemplate.replaceAll(/\{([^}]+)\}/g, ":$1"),
		);
		const generatedOperationId = operation.operationId;
		const publicOperationId =
			generatedOperationId?.replace(/ApiV[1-9]\d*(?=[A-Z]|$)/, "Api") === routeOperationId
				? routeOperationId
				: (generatedOperationId ?? routeOperationId);
		const quotaOperation = resolveApiQuotaOperation(routeOperationId);
		if (!operation.security) {
			const unauthorized = operation.responses[StatusCodes.UNAUTHORIZED];
			if (containsJsonValue(unauthorized, "InteractiveSessionRequired"))
				operation.security = [{ SessionCookie: [] }];
			else if (containsJsonValue(unauthorized, "AuthenticationRequired"))
				operation.security = [{ ApiToken: [] }, { SessionCookie: [] }];
		}
		if (quotaOperation.scope && !operation.security)
			operation.security = [{}, { ApiToken: [] }, { SessionCookie: [] }];
		decorateRetryableResponse(operation.responses, {
			acceptsApiToken: Boolean(
				operation.security?.some(
					(requirement: OpenAPIV3.SecurityRequirementObject) => "ApiToken" in requirement,
				),
			),
			operation: `${method.toUpperCase()} ${pathTemplate}`,
		});
		Object.assign(operation, {
			operationId: publicOperationId,
			"x-rezics-quota-route-operation-id": routeOperationId,
			"x-rezics-quota-operation-id": quotaOperation.scope ?? "*",
			"x-rezics-quota-cost-units": quotaOperation.costUnits,
		});
		const badRequest = operation.responses[StatusCodes.BAD_REQUEST];
		const badRequestResponse = isResponseObject(badRequest) ? badRequest : undefined;
		const badRequestSchema = badRequestResponse?.content?.["application/json"]?.schema;
		if (operation.requestBody && badRequest && !badRequestResponse)
			throw new Error(`Cannot merge referenced 400 response for ${method} ${pathTemplate}`);
		if (operation.requestBody && badRequestResponse && !badRequestSchema)
			throw new Error(`Cannot merge non-JSON 400 response for ${method} ${pathTemplate}`);
		if (operation.requestBody && !containsJsonValue(badRequest, "MalformedRequestBody"))
			operation.responses[StatusCodes.BAD_REQUEST] = badRequestSchema
				? {
						...badRequestResponse,
						content: {
							...badRequestResponse.content,
							"application/json": {
								...badRequestResponse.content?.["application/json"],
								schema: {
									oneOf: [badRequestSchema, { $ref: "#/components/schemas/MalformedRequestBody" }],
								},
							},
						},
					}
				: malformedRequestBodyResponse;
		const validation = operation.responses[StatusCodes.UNPROCESSABLE_ENTITY];
		const validationResponse = isResponseObject(validation) ? validation : undefined;
		const validationSchema = validationResponse?.content?.["application/json"]?.schema;
		const validatesInput = Boolean(operation.requestBody || operation.parameters?.length);
		if (validationSchema || validatesInput)
			operation.responses[StatusCodes.UNPROCESSABLE_ENTITY] = validationSchema
				? {
						description: validationResponse.description,
						content: {
							"application/json": {
								schema: {
									oneOf: [validationSchema, { $ref: "#/components/schemas/ValidationError" }],
								},
							},
						},
					}
				: validationErrorResponse;
		operation.responses[StatusCodes.INTERNAL_SERVER_ERROR] ??= internalErrorResponse;
		// Elysia 1 merged the published request/quota error responses from the GET
		// health route into its explicit HEAD sibling. Retain that public response
		// union through the framework migration even though HEAD has no input body.
		if (routeOperationId === "headApiHealth") {
			operation.responses[StatusCodes.UNPROCESSABLE_ENTITY] ??= validationErrorResponse;
			operation.responses[StatusCodes.TOO_MANY_REQUESTS] ??= ApiQuotaExceededResponse;
		}
	}
}

const outputPath = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"../../../libraries/services/main/openapi/openapi.json",
);

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, await formatWithBiome(JSON.stringify(document), outputPath));
await observability.shutdown();
