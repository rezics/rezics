/** @vitest-environment jsdom */

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	session: {
		status: "anonymous",
		data: null as { user: { id: string } } | null,
		error: null,
		refetch: vi.fn(),
	},
	preferences: {
		data: undefined as
			| {
					profileId: string;
					interfaceLocale: "zh-Hant";
					chineseContentDisplay: "original";
					filterFeedByPreferredLanguages: boolean;
					preferredLanguages: ("en" | "zh")[];
			  }
			| undefined,
		isError: false,
		error: null as unknown,
		refetch: vi.fn(),
	},
}));

vi.mock("@/lib/use-hydrated-session", () => ({
	useHydratedSession: () => mocks.session,
}));

vi.mock("@/features/preferences/data/use-presentation-preferences", () => ({
	usePresentationPreferences: () => mocks.preferences,
}));

vi.mock("./client", () => ({
	useTranslation: () => ({ locale: { target: "zh-Hant" } }),
}));

import { useLocalizationLanguageState } from "./use-localization-languages";

beforeEach(() => {
	mocks.session.status = "anonymous";
	mocks.session.data = null;
	mocks.session.error = null;
	mocks.session.refetch.mockReset();
	mocks.preferences.data = undefined;
	mocks.preferences.isError = false;
	mocks.preferences.error = null;
	mocks.preferences.refetch.mockReset();
});

describe("localization language state", () => {
	it("uses the interface language immediately for anonymous viewers", () => {
		const { result } = renderHook(useLocalizationLanguageState);

		expect(result.current).toEqual({
			status: "ready",
			languages: ["zh"],
			source: "anonymous",
		});
	});

	it("preserves the authenticated preference order before the interface fallback", () => {
		mocks.session.status = "authenticated";
		mocks.session.data = { user: { id: "profile-a" } };
		mocks.preferences.data = {
			profileId: "profile-a",
			interfaceLocale: "zh-Hant",
			chineseContentDisplay: "original",
			filterFeedByPreferredLanguages: false,
			preferredLanguages: ["en"],
		};

		const { result } = renderHook(useLocalizationLanguageState);

		expect(result.current).toEqual({
			status: "ready",
			languages: ["en", "zh"],
			source: "profile",
		});
	});

	it("keeps authenticated consumers restoring until preferences are proven", () => {
		mocks.session.status = "authenticated";
		mocks.session.data = { user: { id: "profile-a" } };

		const { result } = renderHook(useLocalizationLanguageState);

		expect(result.current).toEqual({ status: "restoring" });
	});

	it("exposes preference failures and their retry operation", () => {
		const error = new Error("preferences unavailable");
		mocks.session.status = "authenticated";
		mocks.session.data = { user: { id: "profile-a" } };
		mocks.preferences.isError = true;
		mocks.preferences.error = error;

		const { result } = renderHook(useLocalizationLanguageState);

		expect(result.current.status).toBe("error");
		if (result.current.status !== "error") return;
		expect(result.current.error).toBe(error);
		act(result.current.retry);
		expect(mocks.preferences.refetch).toHaveBeenCalledOnce();
	});

	it("keeps the last validated preference usable after a background refresh failure", () => {
		mocks.session.status = "authenticated";
		mocks.session.data = { user: { id: "profile-a" } };
		mocks.preferences.data = {
			profileId: "profile-a",
			interfaceLocale: "zh-Hant",
			chineseContentDisplay: "original",
			filterFeedByPreferredLanguages: false,
			preferredLanguages: ["en"],
		};
		mocks.preferences.isError = true;
		mocks.preferences.error = new Error("background refresh unavailable");

		const { result } = renderHook(useLocalizationLanguageState);

		expect(result.current).toEqual({
			status: "ready",
			languages: ["en", "zh"],
			source: "profile",
		});
	});
});
