import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";

import {
	getInitialPresentationPreferences,
	seedInitialPresentationPreferences,
} from "./initial-presentation-preferences.server";
import { presentationPreferencesQueryKey } from "../model/presentation-preferences";

const payload = {
	profileId: "00000000-0000-4000-8000-000000000001",
	interfaceLocale: "zh-Hant",
	chineseContentDisplay: "original",
	filterFeedByPreferredLanguages: false,
	preferredLanguages: ["en"],
} as const;

const originalApiOrigin = process.env.REZICS_API_ORIGIN;

afterEach(() => {
	vi.unstubAllGlobals();
	if (originalApiOrigin === undefined) delete process.env.REZICS_API_ORIGIN;
	else process.env.REZICS_API_ORIGIN = originalApiOrigin;
});

describe("initial presentation preferences", () => {
	it("hydrates a Profile Unit's preferences under its distinct auth account", () => {
		const queryClient = new QueryClient();
		seedInitialPresentationPreferences(
			queryClient,
			{
				status: "resolved",
				data: {
					session: {
						id: "session-a",
						userId: "account-a",
						token: "token-a",
						createdAt: new Date("2026-07-28T00:00:00.000Z"),
						updatedAt: new Date("2026-07-28T00:00:00.000Z"),
						expiresAt: new Date("2026-08-04T00:00:00.000Z"),
					},
					user: {
						id: "account-a",
						email: "member@example.com",
						emailVerified: true,
						name: "Member",
						createdAt: new Date("2026-07-28T00:00:00.000Z"),
						updatedAt: new Date("2026-07-28T00:00:00.000Z"),
					},
				},
			},
			{ status: "resolved", data: payload },
		);

		expect(queryClient.getQueryData(presentationPreferencesQueryKey("account-a"))).toEqual(payload);
		expect(queryClient.getQueryData(presentationPreferencesQueryKey(payload.profileId))).toBe(
			undefined,
		);
	});

	it("does not call the backend without a session cookie", async () => {
		const fetch = vi.fn();
		vi.stubGlobal("fetch", fetch);

		await expect(getInitialPresentationPreferences(new Headers())).resolves.toEqual({
			status: "unavailable",
		});
		expect(fetch).not.toHaveBeenCalled();
	});

	it("forwards locale negotiation headers and returns validated presentation fields", async () => {
		process.env.REZICS_API_ORIGIN = "https://api.internal.example";
		let request:
			| {
					readonly url: string;
					readonly cookie: string | null;
					readonly acceptLanguage: string | null;
					readonly authorization: string | null;
					readonly cache: RequestCache | undefined;
			  }
			| undefined;
		vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
			const headers = new Headers(init?.headers);
			request = {
				url: String(input),
				cookie: headers.get("cookie"),
				acceptLanguage: headers.get("accept-language"),
				authorization: headers.get("authorization"),
				cache: init?.cache,
			};
			return Response.json({ ...payload, unrelatedPreference: "ignored" });
		});
		const headers = new Headers({
			cookie: "better-auth.session_token=opaque",
			"accept-language": "zh-CN, zh;q=0.9",
			authorization: "Bearer do-not-forward",
		});

		await expect(getInitialPresentationPreferences(headers)).resolves.toEqual({
			status: "resolved",
			data: payload,
		});
		expect(request).toEqual({
			url: "https://api.internal.example/api/v1/users/me/preferences",
			cookie: "better-auth.session_token=opaque",
			acceptLanguage: "zh-CN, zh;q=0.9",
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
