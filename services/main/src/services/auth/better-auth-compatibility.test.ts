import { apiKey } from "@better-auth/api-key";
import { getTestInstance } from "better-auth/test";
import Elysia from "elysia";
import { beforeAll, describe, expect, it } from "vitest";

const TrustedOrigin = "http://localhost:3000";

function createFixture() {
	return getTestInstance({
		basePath: "/api/auth",
		trustedOrigins: [TrustedOrigin],
		disabledPaths: [
			"/api-key/create",
			"/api-key/get",
			"/api-key/list",
			"/api-key/update",
			"/api-key/delete",
		],
		advanced: { disableOriginCheck: false, database: { generateId: "uuid" } },
		plugins: [
			apiKey({
				references: "user",
				disableKeyHashing: false,
				defaultPrefix: "rz_api_",
				defaultKeyLength: 64,
				requireName: true,
				minimumNameLength: 1,
				maximumNameLength: 120,
				startingCharactersConfig: { shouldStore: true, charactersLength: 14 },
				keyExpiration: {
					defaultExpiresIn: 60 * 60 * 24 * 90,
					disableCustomExpiresTime: false,
					minExpiresIn: 1,
					maxExpiresIn: 60 * 60 * 24 * 365,
				},
				rateLimit: { enabled: true, timeWindow: 60_000, maxRequests: 5_000 },
				enableSessionForAPIKeys: false,
				storage: "database",
				deferUpdates: false,
			}),
		],
	});
}

type Fixture = Awaited<ReturnType<typeof createFixture>>;
let fixture: Fixture;

beforeAll(async () => {
	fixture = await createFixture();
});

async function signIn() {
	const signedIn = await fixture.signInWithTestUser();
	const current = await fixture.auth.api.getSession({ headers: signedIn.headers });
	if (!current) throw new Error("Expected the Better Auth test session to be active");
	return { ...signedIn, current };
}

describe("Better Auth 1.7 compatibility", () => {
	it("mounts and preserves health and anonymous session responses", async () => {
		const app = new Elysia().mount(fixture.auth.handler);
		const health = await app.handle(new Request("http://localhost:3000/api/auth/ok"));
		const session = await app.handle(new Request("http://localhost:3000/api/auth/get-session"));

		expect(health.status).toBe(200);
		expect(await health.json()).toEqual({ ok: true });
		expect(session.status).toBe(200);
		expect(session.headers.get("Cache-Control")).toBe("no-store");
		expect(await session.json()).toBeNull();
	});

	it("signs in, rejects an untrusted sign-out, then revokes the session and cookie", async () => {
		const signedIn = await signIn();
		const cookie = signedIn.headers.get("cookie");
		expect(cookie).toContain("better-auth.session_token=");
		expect(signedIn.current).toMatchObject({
			session: { id: signedIn.current.session.id },
			user: { id: signedIn.current.user.id },
		});

		const rejected = await fixture.auth.handler(
			new Request("http://localhost:3000/api/auth/sign-out", {
				method: "POST",
				headers: {
					Cookie: cookie ?? "",
					"Content-Type": "application/json",
					Origin: "https://untrusted.example",
				},
				body: "{}",
			}),
		);
		expect(rejected.status).toBe(403);
		expect(await rejected.json()).toMatchObject({ code: "INVALID_ORIGIN" });
		expect(await fixture.auth.api.getSession({ headers: signedIn.headers })).not.toBeNull();

		const signedOut = await fixture.auth.handler(
			new Request("http://localhost:3000/api/auth/sign-out", {
				method: "POST",
				headers: {
					Cookie: cookie ?? "",
					"Content-Type": "application/json",
					Origin: TrustedOrigin,
				},
				body: "{}",
			}),
		);
		expect(signedOut.status).toBe(200);
		expect(await signedOut.json()).toMatchObject({ success: true });
		expect(signedOut.headers.get("Set-Cookie")).toContain("better-auth.session_token=");
		expect(signedOut.headers.get("Set-Cookie")).toContain("Max-Age=0");
		expect(await fixture.auth.api.getSession({ headers: signedIn.headers })).toBeNull();
	});

	it("expires an outdated session and clears its cookie", async () => {
		const signedIn = await signIn();
		await fixture.db.update({
			model: "session",
			where: [{ field: "id", value: signedIn.current.session.id }],
			update: { expiresAt: new Date(0) },
		});
		const response = await fixture.auth.handler(
			new Request("http://localhost:3000/api/auth/get-session", {
				headers: signedIn.headers,
			}),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toBeNull();
		expect(response.headers.get("Set-Cookie")).toContain("better-auth.session_token=");
		expect(response.headers.get("Set-Cookie")).toContain("Max-Age=0");
	});

	it("supports API-key create, get, list, update, delete, and bearer verification", async () => {
		const signedIn = await signIn();
		const created = await fixture.auth.api.createApiKey({
			body: {
				name: "Compatibility key",
				userId: signedIn.current.user.id,
				permissions: { units: ["read"] },
			},
		});
		expect(created.key).toMatch(/^rz_api_/);
		expect(created.name).toBe("Compatibility key");
		expect(created.referenceId).toBe(signedIn.current.user.id);

		const fetched = await fixture.auth.api.getApiKey({
			headers: signedIn.headers,
			query: { id: created.id },
		});
		expect(fetched).toMatchObject({ id: created.id, name: "Compatibility key" });

		const listed = await fixture.auth.api.listApiKeys({ headers: signedIn.headers });
		expect(listed.apiKeys).toEqual(
			expect.arrayContaining([expect.objectContaining({ id: created.id })]),
		);

		const bearer = new Headers({ Authorization: `Bearer ${created.key}` });
		const bearerToken = bearer.get("Authorization")?.replace(/^Bearer\s+/i, "");
		if (!bearerToken) throw new Error("Expected an API key bearer token");
		const verified = await fixture.auth.api.verifyApiKey({ body: { key: bearerToken } });
		expect(verified).toMatchObject({
			valid: true,
			error: null,
			key: { id: created.id, referenceId: signedIn.current.user.id },
		});

		const updated = await fixture.auth.api.updateApiKey({
			body: {
				keyId: created.id,
				userId: signedIn.current.user.id,
				name: "Updated compatibility key",
				enabled: false,
			},
		});
		expect(updated).toMatchObject({
			id: created.id,
			name: "Updated compatibility key",
			enabled: false,
		});
		expect(await fixture.auth.api.verifyApiKey({ body: { key: bearerToken } })).toMatchObject({
			valid: false,
			key: null,
		});

		expect(
			await fixture.auth.api.deleteApiKey({
				headers: signedIn.headers,
				body: { keyId: created.id },
			}),
		).toEqual({ success: true });
		expect((await fixture.auth.api.listApiKeys({ headers: signedIn.headers })).apiKeys).not.toEqual(
			expect.arrayContaining([expect.objectContaining({ id: created.id })]),
		);
	});
});
