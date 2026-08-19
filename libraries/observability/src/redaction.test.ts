import { describe, expect, it } from "vitest";

import { redact } from "./redaction";

describe("telemetry redaction", () => {
	it("redacts representative nested secrets, identities, bodies, signed URLs, and errors", () => {
		const secret = "fixture-secret-do-not-emit";
		const cause = new Error(`authorization=Bearer ${secret}`);
		const error = new Error(`token=${secret}`, { cause });
		error.stack = `Error: token=${secret}\n at test@example.com`;
		const circular: Record<string, unknown> = {
			headers: {
				Authorization: `Bearer ${secret}`,
				Cookie: `session=${secret}`,
				Accept: "application/json",
			},
			requestBody: { password: secret },
			profileId: secret,
			nested: [
				{
					url: `https://storage.example/object?X-Amz-Signature=${secret}`,
					message: `contact test@example.com token=${secret}`,
				},
			],
			error,
		};
		circular.self = circular;

		const serialized = JSON.stringify(redact(circular, false));

		expect(serialized).not.toContain(secret);
		expect(serialized).not.toContain("test@example.com");
		expect(serialized).not.toContain("X-Amz-Signature");
		expect(serialized).toContain("[REDACTED]");
		expect(serialized).toContain("[CIRCULAR]");
	});

	it("preserves request correlation identifiers", () => {
		const requestId = "3d708872-45bc-4ecf-b31b-7f7301869d7d";
		const serialized = JSON.stringify(
			redact({ requestId, attributes: { requestId }, unitId: requestId }, false),
		);

		expect(serialized).toContain(requestId);
		expect(serialized).toContain("[REDACTED]");
	});

	it("removes stack data in production", () => {
		const serialized = JSON.stringify(redact(new Error("safe failure"), true));

		expect(serialized).not.toContain("stack");
		expect(serialized).toContain("safe failure");
	});

	it("removes SQL and parameters embedded by database error wrappers", () => {
		const secret = "fixture-database-parameter";
		const error = new Error(
			`Failed query: insert into users (email, token) values ($1, $2)\nparams: test@example.com,${secret}`,
		);
		error.name = "DrizzleQueryError";
		error.stack = `${error.name}: ${error.message}\n    at database.ts:1:1`;

		const serialized = JSON.stringify(redact(error, false));

		expect(serialized).not.toContain("insert into");
		expect(serialized).not.toContain("params:");
		expect(serialized).not.toContain(secret);
		expect(serialized).toContain("Database query failed");
	});
});
