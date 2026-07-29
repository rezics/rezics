import { afterEach, describe, expect, it, vi } from "vitest";

import { getInitialPresentationPreferences } from "./initial-presentation-preferences.server";

const payload = {
	profileId: "00000000-0000-4000-8000-000000000001",
	interfaceLocale: "zh-Hant",
	chineseContentDisplay: "original",
	filterFeedByPreferredLanguages: false,
	preferredLanguages: ["en"],
};

const originalApiOrigin = process.env.REZICS_API_ORIGIN;

afterEach(() => {
	vi.unstubAllGlobals();
	if (originalApiOrigin === undefined) delete process.env.REZICS_API_ORIGIN;
	else process.env.REZICS_API_ORIGIN = originalApiOrigin;
});

describe("initial presentation preferences", () => {
	it("does not call the backend without a session cookie", async () => {
		const fetch = vi.fn();
		vi.stubGlobal("fetch", fetch);

		await expect(getInitialPresentationPreferences(new Headers())).resolves.toEqual({
			status: "unavailable",
		});
		expect(fetch).not.toHaveBeenCalled();
	});

	it("forwards only the request cookie and returns validated presentation fields", async () => {
		process.env.REZICS_API_ORIGIN = "https://api.internal.example";
		let request:
			| {
					readonly url: string;
					readonly cookie: string | null;
					readonly authorization: string | null;
					readonly cache: RequestCache | undefined;
			  }
			| undefined;
		vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
			const headers = new Headers(init?.headers);
			request = {
				url: String(input),
				cookie: headers.get("cookie"),
				authorization: headers.get("authorization"),
				cache: init?.cache,
			};
			return Response.json({ ...payload, unrelatedPreference: "ignored" });
		});
		const headers = new Headers({
			cookie: "better-auth.session_token=opaque",
			authorization: "Bearer do-not-forward",
		});

		await expect(getInitialPresentationPreferences(headers)).resolves.toEqual({
			status: "resolved",
			data: payload,
		});
		expect(request).toEqual({
			url: "https://api.internal.example/api/users/me/preferences",
			cookie: "better-auth.session_token=opaque",
			authorization: null,
			cache: "no-store",
		});
	});

	it("fails closed for a malformed successful response", async () => {
		vi.stubGlobal("fetch", async () =>
			Response.json({ ...payload, preferredLanguages: ["unsupported"] }),
		);
		const headers = new Headers({ cookie: "better-auth.session_token=opaque" });

		await expect(getInitialPresentationPreferences(headers)).resolves.toEqual({
			status: "unavailable",
		});
	});
});
