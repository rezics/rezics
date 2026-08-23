import type { OpenAPIV3 } from "openapi-types";

const ApiQuotaErrorCodes = ["ApiQuotaExceeded", "ApiTokenRateLimitExceeded"] as const;

const ApiQuotaExceededSchema = {
	type: "object",
	required: ["error", "requestId"],
	properties: {
		error: {
			type: "object",
			required: ["code", "message"],
			properties: {
				code: { type: "string", enum: [...ApiQuotaErrorCodes] },
				message: { type: "string" },
				details: { $ref: "#/components/schemas/JsonValue" },
			},
		},
		requestId: { type: "string" },
	},
} satisfies OpenAPIV3.SchemaObject;

const RetryAfterHeader = {
	description: "Seconds until this request can be retried",
	schema: { type: "integer", minimum: 1 },
} satisfies OpenAPIV3.HeaderObject;

export const ApiQuotaExceededResponse = {
	description: "API quota exceeded",
	headers: { "Retry-After": RetryAfterHeader },
	content: { "application/json": { schema: ApiQuotaExceededSchema } },
} satisfies OpenAPIV3.ResponseObject;

function containsJsonValue(value: unknown, target: string): boolean {
	if (value === target) return true;
	if (Array.isArray(value)) return value.some((item) => containsJsonValue(item, target));
	if (typeof value !== "object" || value === null) return false;
	return Object.values(value).some((item) => containsJsonValue(item, target));
}

function isResponseObject(
	response: OpenAPIV3.ReferenceObject | OpenAPIV3.ResponseObject,
): response is OpenAPIV3.ResponseObject {
	return !("$ref" in response);
}

function requireJsonResponse(
	response: OpenAPIV3.ReferenceObject | OpenAPIV3.ResponseObject,
	operation: string,
): {
	readonly response: OpenAPIV3.ResponseObject;
	readonly media: OpenAPIV3.MediaTypeObject;
	readonly schema: OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject;
} {
	if (!isResponseObject(response))
		throw new Error(`Cannot merge referenced 429 response for ${operation}`);
	const media = response.content?.["application/json"];
	if (!media?.schema) throw new Error(`Cannot merge non-JSON 429 response for ${operation}`);
	return { response, media, schema: media.schema };
}

function withRetryAfterHeader(response: OpenAPIV3.ResponseObject): OpenAPIV3.ResponseObject {
	return {
		...response,
		headers: { "Retry-After": RetryAfterHeader, ...response.headers },
	};
}

export function decorateRetryableResponse(
	responses: OpenAPIV3.ResponsesObject,
	options: { readonly acceptsApiToken: boolean; readonly operation: string },
): void {
	const current = responses["429"];
	if (options.acceptsApiToken) {
		if (!current) responses["429"] = ApiQuotaExceededResponse;
		else {
			const { response, media, schema } = requireJsonResponse(current, options.operation);
			const alreadyIncludesQuota = ApiQuotaErrorCodes.every((code) =>
				containsJsonValue(response, code),
			);
			responses["429"] = withRetryAfterHeader(
				alreadyIncludesQuota
					? response
					: {
							...response,
							content: {
								...response.content,
								"application/json": {
									...media,
									schema: { oneOf: [schema, ApiQuotaExceededSchema] },
								},
							},
						},
			);
		}
	}

	const retryable = responses["429"];
	if (!retryable || !containsJsonValue(retryable, "VndbVoteHotKeyBusy")) return;
	if (!isResponseObject(retryable))
		throw new Error(`Cannot add Retry-After to referenced 429 response for ${options.operation}`);
	responses["429"] = withRetryAfterHeader(retryable);
}
