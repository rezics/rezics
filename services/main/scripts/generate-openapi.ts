import { StatusCodes } from "http-status-codes";
process.env.SKIP_VALIDATION ??= "true";
process.env.DATABASE_URL ??= "postgres://openapi:openapi@localhost/openapi";

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { toOpenAPISchema } from "@elysiajs/openapi";
import type { OpenAPIV3 } from "openapi-types";
import { format, resolveConfig } from "prettier";

import { ApiErrorCodes } from "../src/services/api/errors";
import { apiTokenOperationId } from "../src/services/auth/api-token/operation";

const { initializeObservability } = await import("@rezics/observability");
const observability = initializeObservability({
	service: { name: "rezics-openapi-generator", version: "0.1.0", environment: "tooling" },
});
const { default: api } = await import("../src/services/api");

const document = {
	openapi: "3.2.0",
	info: {
		title: "REZICS API",
		version: "0.1.0",
	},
	...toOpenAPISchema(api),
};

const methods = ["get", "post", "put", "patch", "delete", "head"] as const;
const validationErrorResponse = {
	description: "Request validation failed",
	content: {
		"application/json": { schema: { $ref: "#/components/schemas/ValidationError" } },
	},
};
const internalErrorResponse = {
	description: "Unexpected internal failure",
	content: {
		"application/json": { schema: { $ref: "#/components/schemas/InternalError" } },
	},
};
const apiTokenRateLimitResponse = {
	description: "API token resource limit exceeded",
	headers: {
		"Retry-After": {
			description: "Seconds until the limiting window or concurrency lease can be retried",
			schema: { type: "integer", minimum: 1 },
		},
	},
	content: {
		"application/json": {
			schema: {
				type: "object",
				required: ["error", "requestId"],
				properties: {
					error: {
						type: "object",
						required: ["code", "message"],
						properties: {
							code: { type: "string", enum: ["ApiTokenRateLimitExceeded"] },
							message: { type: "string" },
							details: { $ref: "#/components/schemas/JsonValue" },
						},
					},
					requestId: { type: "string" },
				},
			},
		},
	},
} satisfies OpenAPIV3.ResponseObject;
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

for (const [pathTemplate, path] of Object.entries(document.paths)) {
	if (!path) continue;
	for (const method of methods) {
		const operation = path[method];
		if (!operation) continue;
		if (!operation.security) {
			const unauthorized = operation.responses[StatusCodes.UNAUTHORIZED];
			if (containsJsonValue(unauthorized, "InteractiveSessionRequired"))
				operation.security = [{ SessionCookie: [] }];
			else if (containsJsonValue(unauthorized, "AuthenticationRequired"))
				operation.security = [{ ApiToken: [] }, { SessionCookie: [] }];
		}
		if (operation.security?.some((requirement) => "ApiToken" in requirement))
			operation.responses[StatusCodes.TOO_MANY_REQUESTS] ??= apiTokenRateLimitResponse;
		Object.assign(operation, {
			"x-rezics-policy-operation-id": apiTokenOperationId(
				method,
				pathTemplate.replaceAll(/\{([^}]+)\}/g, ":$1"),
			),
		});
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
									oneOf: [
										validationSchema,
										{ $ref: "#/components/schemas/ValidationError" },
									],
								},
							},
						},
					}
				: validationErrorResponse;
		operation.responses[StatusCodes.INTERNAL_SERVER_ERROR] ??= internalErrorResponse;
	}
}

const outputPath = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"../../../libraries/services/main/openapi/openapi.json",
);

mkdirSync(dirname(outputPath), { recursive: true });
const prettierConfig = (await resolveConfig(outputPath)) ?? {};
writeFileSync(
	outputPath,
	await format(JSON.stringify(document), { ...prettierConfig, filepath: outputPath }),
);
await observability.shutdown();
