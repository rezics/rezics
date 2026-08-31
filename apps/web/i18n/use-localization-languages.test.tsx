/** @vitest-environment jsdom */

import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	requestedLanguage: undefined as "ja" | undefined,
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

vi.mock("@/features/content-languages/hooks/use-content-language-navigation", () => ({
	useRequestedContentLanguage: () => mocks.requestedLanguage,
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

import {
	useLocalizationLanguages,
	useLocalizationLanguageState,
} from "./use-localization-languages";
import { BrowserContentLanguagesProvider } from "./browser-content-languages";

function browserLanguages(languages: readonly ("en" | "zh")[]) {
	return function BrowserLanguages({ children }: { readonly children: ReactNode }) {
		return (
			<BrowserContentLanguagesProvider languages={languages}>
				{children}
			</BrowserContentLanguagesProvider>
		);
	};
}

beforeEach(() => {
	mocks.requestedLanguage = undefined;
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
	it("uses the interface language for anonymous viewers", () => {
		const { result } = renderHook(useLocalizationLanguageState);

		expect(result.current).toEqual({
			status: "ready",
			languages: ["zh"],
			source: "anonymous",
		});
	});

	it("places browser languages after the anonymous interface language", () => {
		const { result } = renderHook(useLocalizationLanguageState, {
			wrapper: browserLanguages(["en"]),
		});

		expect(result.current).toEqual({
			status: "ready",
			languages: ["zh", "en"],
			source: "anonymous",
		});
	});

	it("prepends an explicit content-language override without duplicating preferences", () => {
		mocks.requestedLanguage = "ja";
		const { result } = renderHook(useLocalizationLanguages, {
			wrapper: browserLanguages(["en"]),
		});

		expect(result.current).toEqual(["ja", "zh", "en"]);
	});

	it("preserves the authenticated preference order before the interface fallback", () => {
		mocks.session.status = "authenticated";
		mocks.session.data = { user: { id: "account-a" } };
		mocks.preferences.data = {
			profileId: "profile-unit-a",
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
		mocks.session.data = { user: { id: "account-a" } };

		const { result } = renderHook(useLocalizationLanguageState);

		expect(result.current).toEqual({ status: "restoring" });
	});

	it("exposes preference failures and their retry operation", () => {
		const error = new Error("preferences unavailable");
		mocks.session.status = "authenticated";
		mocks.session.data = { user: { id: "account-a" } };
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
		mocks.session.data = { user: { id: "account-a" } };
		mocks.preferences.data = {
			profileId: "profile-unit-a",
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
