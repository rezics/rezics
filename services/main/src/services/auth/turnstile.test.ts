import { describe, expect, it } from "vitest";

import { auth } from ".";

describe("registration Turnstile boundary", () => {
	it("rejects email registration before account creation when the challenge token is missing", async () => {
		const response = await auth.handler(
			new Request("http://localhost:3001/api/auth/sign-up/email", {
				body: JSON.stringify({
					email: "reader@example.com",
					name: "Reader",
					password: "correct-horse-battery-staple",
				}),
				headers: {
					"content-type": "application/json",
					origin: "http://localhost:3000",
				},
				method: "POST",
			}),
		);

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toMatchObject({
			code: "MISSING_RESPONSE",
		});
	});
});
