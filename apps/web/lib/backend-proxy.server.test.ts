import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { proxyBackendRequest } from "./backend-proxy.server";

const originalApiOrigin = process.env.REZICS_API_ORIGIN;

beforeEach(() => {
	process.env.REZICS_API_ORIGIN = "https://api.internal.example";
});

afterEach(() => {
	vi.unstubAllGlobals();
	if (originalApiOrigin === undefined) delete process.env.REZICS_API_ORIGIN;
	else process.env.REZICS_API_ORIGIN = originalApiOrigin;
});

describe("backend proxy", () => {
	it("forwards auth requests to the configured origin without trusting spoofed proxy headers", async () => {
		let forwarded:
			| {
					readonly url: string;
					readonly method: string;
					readonly headers: Headers;
					readonly body: string;
			  }
			| undefined;
		const responseHeaders = new Headers({ "content-type": "application/json" });
		responseHeaders.append("set-cookie", "session=one; Path=/; HttpOnly");
		responseHeaders.append("set-cookie", "csrf=two; Path=/; HttpOnly");
		vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
			const request = input instanceof Request ? input : new Request(input);
			forwarded = {
				url: request.url,
				method: request.method,
				headers: new Headers(request.headers),
				body: await request.text(),
			};
			return new Response('{"ok":true}', {
				status: 200,
				headers: responseHeaders,
			});
		});

		const response = await proxyBackendRequest(
			new Request("https://app.example/api/auth/sign-in/email?next=%2Fme", {
				method: "POST",
				body: '{"email":"member@example.com"}',
				headers: {
					"content-type": "application/json",
					cookie: "existing=value",
					origin: "https://app.example",
					"x-forwarded-host": "attacker.example",
				},
			}),
			{ prefix: "api", path: ["auth", "sign-in", "email"] },
		);

		expect(forwarded).toMatchObject({
			url: "https://api.internal.example/api/auth/sign-in/email?next=%2Fme",
			method: "POST",
			body: '{"email":"member@example.com"}',
		});
		expect(forwarded?.headers.get("cookie")).toBe("existing=value");
		expect(forwarded?.headers.get("origin")).toBe("https://app.example");
		expect(forwarded?.headers.get("accept-encoding")).toBe("identity");
		expect(forwarded?.headers.get("x-forwarded-host")).toBe("app.example");
		expect(forwarded?.headers.get("x-forwarded-proto")).toBe("https");
		expect(response.headers.getSetCookie()).toEqual([
			"session=one; Path=/; HttpOnly",
			"csrf=two; Path=/; HttpOnly",
		]);
		expect(response.headers.get("cache-control")).toBe("private, no-store");
	});

	it("rejects unsafe path segments before making a backend request", async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		const response = await proxyBackendRequest(new Request("https://app.example/api/auth"), {
			prefix: "api",
			path: [".."],
		});

		expect(response.status).toBe(400);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("returns a non-cacheable bad gateway response when the backend is unavailable", async () => {
		vi.stubGlobal("fetch", async () => {
			throw new Error("unavailable");
		});

		const response = await proxyBackendRequest(new Request("https://app.example/api/v1/feed"), {
			prefix: "api",
			path: ["feed"],
		});

		expect(response.status).toBe(502);
		expect(response.headers.get("cache-control")).toBe("private, no-store");
	});
});
