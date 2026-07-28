import { afterEach, describe, expect, it, vi } from "vitest";

import { getInitialAuthSession, parseAuthSessionPayload } from "./initial-session.server";

const payload = {
	session: {
		id: "session-id",
		userId: "user-id",
		token: "session-token",
		createdAt: "2026-07-28T00:00:00.000Z",
		updatedAt: "2026-07-28T00:00:00.000Z",
		expiresAt: "2026-08-04T00:00:00.000Z",
		ipAddress: null,
		userAgent: "browser",
	},
	user: {
		id: "user-id",
		email: "member@example.com",
		emailVerified: true,
		name: "Member",
		image: null,
		createdAt: "2026-07-28T00:00:00.000Z",
		updatedAt: "2026-07-28T00:00:00.000Z",
	},
};

const originalApiOrigin = process.env.REZICS_API_ORIGIN;

afterEach(() => {
	vi.unstubAllGlobals();
	if (originalApiOrigin === undefined) delete process.env.REZICS_API_ORIGIN;
	else process.env.REZICS_API_ORIGIN = originalApiOrigin;
});

describe("initial auth session", () => {
	it("parses and revives a valid Better Auth session", () => {
		const result = parseAuthSessionPayload(payload);

		expect(result.valid).toBe(true);
		if (!result.valid || !result.data) return;
		expect(result.data.session.expiresAt).toEqual(new Date("2026-08-04T00:00:00.000Z"));
		expect(result.data.user.createdAt).toBeInstanceOf(Date);
	});

	it("accepts a proven anonymous response", () => {
		expect(parseAuthSessionPayload(null)).toEqual({ valid: true, data: null });
	});

	it("fails closed for malformed identity data", () => {
		expect(
			parseAuthSessionPayload({
				...payload,
				user: { ...payload.user, emailVerified: "yes" },
			}),
		).toEqual({ valid: false });
		expect(
			parseAuthSessionPayload({
				...payload,
				session: { ...payload.session, expiresAt: "tomorrow" },
			}),
		).toEqual({ valid: false });
		expect(
			parseAuthSessionPayload({
				...payload,
				session: {
					...payload.session,
					expiresAt: "2026-02-31T00:00:00.000Z",
				},
			}),
		).toEqual({ valid: false });
	});

	it("does not call the backend when the request has no session cookie", async () => {
		await expect(getInitialAuthSession(new Headers())).resolves.toEqual({
			status: "resolved",
			data: null,
		});
	});

	it("forwards only the request cookie to the internal session endpoint", async () => {
		process.env.REZICS_API_ORIGIN = "https://api.internal.example";
		let request:
			| {
					readonly url: string;
					readonly cookie: string | null;
					readonly cache: RequestCache | undefined;
			  }
			| undefined;
		vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
			request = {
				url: String(input),
				cookie: new Headers(init?.headers).get("cookie"),
				cache: init?.cache,
			};
			return Response.json(payload);
		});
		const headers = new Headers({
			cookie: "better-auth.session_token=opaque",
			authorization: "Bearer do-not-forward",
		});

		const result = await getInitialAuthSession(headers);

		expect(request).toEqual({
			url: "https://api.internal.example/api/auth/get-session?disableRefresh=true",
			cookie: "better-auth.session_token=opaque",
			cache: "no-store",
		});
		expect(result.status).toBe("resolved");
	});
});
