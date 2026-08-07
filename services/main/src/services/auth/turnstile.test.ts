import { describe, expect, it, vi } from "vitest";

import { auth } from ".";

describe("registration Turnstile boundary", () => {
	it("accepts the local test token before normal sign-up validation", async () => {
		const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					success: true,
					hostname: "example.com",
				}),
				{ headers: { "content-type": "application/json" } },
			),
		);

		const response = await auth.handler(
			new Request("http://localhost:3001/api/auth/sign-up/email", {
				body: JSON.stringify({
					email: "reader@example.com",
					name: "Reader",
					password: "short",
				}),
				headers: {
					"content-type": "application/json",
					origin: "http://localhost:3000",
					"x-captcha-response": "XXXX.DUMMY.TOKEN.XXXX",
				},
				method: "POST",
			}),
		);

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toMatchObject({
			code: "PASSWORD_TOO_SHORT",
		});
	});

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
