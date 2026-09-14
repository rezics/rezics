import { createMcpProtectedRequestHandler } from "@better-auth/mcp";
import { afterEach, describe, expect, it, vi } from "vitest";

const issuer = "https://auth.example/api/auth";
const audience = "https://api.example/mcp";
const protect = createMcpProtectedRequestHandler(
	{
		issuer,
		audience,
		requiredScopes: ["mcp:read"],
		remoteVerify: {
			introspectUrl: `${issuer}/oauth2/introspect`,
			clientId: "resource-server-fixture",
			clientSecret: "fixture-only-secret",
			force: true,
		},
	},
	async () => Response.json({ accepted: true }),
);
const request = () =>
	new Request(audience, { headers: { Authorization: "Bearer opaque-fixture" } });
const valid = () => ({
	active: true,
	iss: issuer,
	aud: audience,
	sub: "scoped-subject",
	scope: "mcp:read",
	exp: Math.floor(Date.now() / 1000) + 60,
});
afterEach(() => vi.unstubAllGlobals());

describe("opaque MCP token verification", () => {
	it.each([
		["wrong audience", { aud: "https://other.example/mcp" }],
		["missing audience", { aud: undefined }],
		["wrong issuer", { iss: "https://other.example/auth" }],
		["expired", { exp: 1 }],
		["future activation", { nbf: 9_999_999_999 }],
		["invalid expiry", { exp: "tomorrow" }],
	])("returns a 401 discovery challenge for %s", async (_name, claims) => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => Response.json({ ...valid(), ...claims })),
		);
		const response = await protect(request());
		expect(response.status).toBe(401);
		expect(response.headers.get("WWW-Authenticate")).toContain(
			'resource_metadata="https://api.example/.well-known/oauth-protected-resource/mcp"',
		);
		expect(await response.json()).toMatchObject({ error: { message: "invalid access token" } });
	});

	it("accepts valid remote claims and returns a scope challenge for insufficient scope", async () => {
		const fetch = vi.fn(async () => Response.json(valid()));
		vi.stubGlobal("fetch", fetch);
		expect((await protect(request())).status).toBe(200);
		fetch.mockImplementation(async () => Response.json({ ...valid(), scope: "mcp:other" }));
		const denied = await protect(request());
		expect(denied.status).toBe(403);
		expect(denied.headers.get("WWW-Authenticate")).toContain('error="insufficient_scope"');
	});

	it("preserves an unavailable introspection service as an operational failure", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response(null, { status: 503 })),
		);
		await expect(protect(request())).rejects.toMatchObject({ status: "INTERNAL_SERVER_ERROR" });
	});
});
