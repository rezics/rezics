import { afterEach, describe, expect, it, vi } from "vitest";

import { getConsoleRouteAccess } from "./console-route-access.server";

const originalApiOrigin = process.env.REZICS_API_ORIGIN;

afterEach(() => {
	if (originalApiOrigin === undefined) delete process.env.REZICS_API_ORIGIN;
	else process.env.REZICS_API_ORIGIN = originalApiOrigin;
});

describe("console route access", () => {
	it("does not call the backend when no session cookie exists", async () => {
		const fetcher = vi.fn<typeof fetch>();

		await expect(getConsoleRouteAccess(new Headers(), fetcher)).resolves.toEqual({
			kind: "unauthenticated",
		});
		expect(fetcher).not.toHaveBeenCalled();
	});

	it("treats a rejected session as unauthenticated", async () => {
		const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 401 }));

		await expect(
			getConsoleRouteAccess(new Headers({ cookie: "better-auth.session_token=expired" }), fetcher),
		).resolves.toEqual({ kind: "unauthenticated" });
	});

	it("forwards only the cookie and derives allowed console sections", async () => {
		process.env.REZICS_API_ORIGIN = "https://api.internal.example";
		const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
			Response.json({
				platformCapabilities: ["platform.audit.read", "platform.moderate", "future.capability"],
			}),
		);

		const result = await getConsoleRouteAccess(
			new Headers({
				authorization: "Bearer do-not-forward",
				cookie: "better-auth.session_token=opaque",
			}),
			fetcher,
		);

		expect(result).toEqual({
			kind: "authenticated",
			platformCapabilities: ["platform.audit.read", "platform.moderate", "future.capability"],
			accessibleSectionIds: ["moderation", "audit"],
		});
		expect(fetcher).toHaveBeenCalledOnce();
		const [url, init] = fetcher.mock.calls[0] ?? [];
		expect(String(url)).toBe("https://api.internal.example/api/v1/users/me");
		expect(new Headers(init?.headers)).toEqual(
			new Headers({ cookie: "better-auth.session_token=opaque" }),
		);
		expect(init?.cache).toBe("no-store");
		expect(init?.signal).toBeInstanceOf(AbortSignal);
	});

	it("represents an authenticated ordinary user with no console sections", async () => {
		const fetcher = vi
			.fn<typeof fetch>()
			.mockResolvedValue(Response.json({ platformCapabilities: [] }));

		await expect(
			getConsoleRouteAccess(new Headers({ cookie: "better-auth.session_token=ordinary" }), fetcher),
		).resolves.toEqual({
			kind: "authenticated",
			platformCapabilities: [],
			accessibleSectionIds: [],
		});
	});

	it("fails closed for malformed or unavailable authorization data", async () => {
		const requestHeaders = new Headers({ cookie: "better-auth.session_token=opaque" });
		const malformedFetcher = vi
			.fn<typeof fetch>()
			.mockResolvedValue(Response.json({ platformCapabilities: [false] }));
		const unavailableFetcher = vi
			.fn<typeof fetch>()
			.mockResolvedValue(new Response(null, { status: 503 }));

		await expect(getConsoleRouteAccess(requestHeaders, malformedFetcher)).rejects.toThrow(
			"invalid platform capabilities",
		);
		await expect(getConsoleRouteAccess(requestHeaders, unavailableFetcher)).rejects.toThrow(
			"status 503",
		);
	});
});
