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
const isResponseObject = (
	response: OpenAPIV3.ReferenceObject | OpenAPIV3.ResponseObject | undefined,
): response is OpenAPIV3.ResponseObject => Boolean(response && !("$ref" in response));

document.components ??= { schemas: {} };
document.components.schemas ??= {};
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

for (const path of Object.values(document.paths)) {
	if (!path) continue;
	for (const method of methods) {
		const operation = path[method];
		if (!operation) continue;
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
