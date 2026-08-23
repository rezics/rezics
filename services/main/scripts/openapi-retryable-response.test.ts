import type { OpenAPIV3 } from "openapi-types";
import { describe, expect, it } from "vitest";

import { decorateRetryableResponse } from "./openapi-retryable-response";

const hotKeyResponse = {
	description: "VNDB vote target is busy",
	content: {
		"application/json": {
			schema: {
				type: "object",
				properties: {
					error: {
						type: "object",
						properties: {
							code: { type: "string", enum: ["VndbVoteHotKeyBusy"] },
						},
					},
				},
			},
		},
	},
} satisfies OpenAPIV3.ResponseObject;

function serialized429(responses: OpenAPIV3.ResponsesObject): string {
	const response = responses["429"];
	if (!response) throw new Error("Expected a 429 response");
	return JSON.stringify(response);
}

function expectRetryAfter(responses: OpenAPIV3.ResponsesObject): void {
	const response = responses["429"];
	if (!response || "$ref" in response) throw new Error("Expected an inline 429 response");
	expect(response.headers?.["Retry-After"]).toBeDefined();
}

describe("OpenAPI retryable responses", () => {
	it("merges API quota and hot-key errors for an API-token vote route", () => {
		const responses = { "429": hotKeyResponse } satisfies OpenAPIV3.ResponsesObject;

		decorateRetryableResponse(responses, {
			acceptsApiToken: true,
			operation: "PUT /api/v1/units/{type}/{unitId}/tags/{tagId}/vote",
		});

		const serialized = serialized429(responses);
		expect(serialized).toContain("VndbVoteHotKeyBusy");
		expect(serialized).toContain("ApiQuotaExceeded");
		expect(serialized).toContain("ApiTokenRateLimitExceeded");
		expectRetryAfter(responses);
	});

	it("keeps hot-key errors off an unrelated API-token route", () => {
		const responses = {
			"200": { description: "Success" },
		} satisfies OpenAPIV3.ResponsesObject;

		decorateRetryableResponse(responses, {
			acceptsApiToken: true,
			operation: "GET /api/v1/units/{type}",
		});

		const serialized = serialized429(responses);
		expect(serialized).toContain("ApiQuotaExceeded");
		expect(serialized).toContain("ApiTokenRateLimitExceeded");
		expect(serialized).not.toContain("VndbVoteHotKeyBusy");
		expectRetryAfter(responses);
	});

	it("documents Retry-After for session-only hot-key backpressure", () => {
		const responses = { "429": hotKeyResponse } satisfies OpenAPIV3.ResponsesObject;

		decorateRetryableResponse(responses, {
			acceptsApiToken: false,
			operation: "PUT /api/v1/realms/{realmId}/tags/{tagId}/context",
		});

		expect(serialized429(responses)).not.toContain("ApiQuotaExceeded");
		expectRetryAfter(responses);
	});
});
