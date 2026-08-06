import { describe, expect, test } from "vitest";
import { apiTokenFromEnv, createRezicsClient } from "./index";

describe("public API client", () => {
	test("requires a non-empty environment token without echoing its value", () => {
		expect(() => apiTokenFromEnv(undefined)).toThrow("token is missing");
		expect(() => apiTokenFromEnv("secret with spaces")).toThrow("contains whitespace");
	});

	test("creates an isolated bearer client and omits browser cookies", async () => {
		const token = apiTokenFromEnv("test-token");
		const client = createRezicsClient({
			baseUrl: "http://localhost:3000/",
			token: () => token,
		});
		const config = client.getConfig();
		const resolveAuth = config.auth;

		expect(config.baseURL).toBe("http://localhost:3000");
		expect(config.credentials).toBe("omit");
		expect(typeof resolveAuth).toBe("function");
		if (typeof resolveAuth !== "function") throw new Error("Expected an auth resolver");
		expect(await resolveAuth({ type: "http", scheme: "bearer" })).toBe(token);
		expect(await resolveAuth({ type: "apiKey", name: "session", in: "cookie" })).toBe(
			undefined,
		);
		const publicRequest = await client.interceptors.request.run({
			url: "http://localhost:3000/api/v1/health",
			method: "GET",
			headers: {},
		});
		expect(new Headers(publicRequest.headers).get("Authorization")).toBe(`Bearer ${token}`);
		await expect(
			client.interceptors.request.run({
				url: "https://example.com/api/v1/health",
				method: "GET",
				headers: {},
			}),
		).rejects.toThrow("refused to send credentials to another origin");
	});

	test("rejects credentials in URLs and insecure remote origins", () => {
		const token = apiTokenFromEnv("test-token");
		expect(() =>
			createRezicsClient({ baseUrl: "https://user:pass@example.com", token }),
		).toThrow("must not contain credentials");
		expect(() => createRezicsClient({ baseUrl: "http://example.com", token })).toThrow(
			"must use HTTPS",
		);
	});
});
