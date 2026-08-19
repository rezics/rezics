/** @vitest-environment jsdom */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GetApiUsersMePreferencesStatus200 } from "@rezics/openapi-tanstack-query";

const mocks = vi.hoisted(() => ({
	getPreferences: vi.fn(),
	session: {
		data: { user: { id: "account-a" } },
	},
}));

vi.mock("@rezics/openapi-tanstack-query", () => ({
	getApiUsersMePreferences: mocks.getPreferences,
}));

vi.mock("@/lib/use-hydrated-session", () => ({
	useHydratedSession: () => mocks.session,
}));

import {
	setPresentationPreferencesQueryData,
	usePresentationPreferences,
} from "./use-presentation-preferences";
import { presentationPreferencesQueryKey } from "../model/presentation-preferences";

const response = {
	profileId: "profile-unit-a",
	interfaceLocale: "zh-Hant" as const,
	chineseContentDisplay: "original" as const,
	defaultLicenses: [],
	defaultRealmManageMode: false,
	defaultScoreRealmId: "score-realm",
	scoreVisibility: "public" as const,
	progressVisibility: "public" as const,
	collectionConfig: null,
	personalizedFeed: true,
	filterFeedByPreferredLanguages: false,
	contentRatings: ["general" as const],
	preferredLanguages: ["en" as const],
} satisfies GetApiUsersMePreferencesStatus200;

const preferences = {
	profileId: response.profileId,
	interfaceLocale: response.interfaceLocale,
	chineseContentDisplay: response.chineseContentDisplay,
	filterFeedByPreferredLanguages: response.filterFeedByPreferredLanguages,
	preferredLanguages: response.preferredLanguages,
};

beforeEach(() => {
	mocks.getPreferences.mockReset();
});

describe("presentation preferences query", () => {
	it("accepts the authenticated account's distinct Profile Unit ID", async () => {
		mocks.getPreferences.mockResolvedValue({ data: response });
		const queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		const wrapper = ({ children }: { readonly children: React.ReactNode }) => (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		);

		const { result } = renderHook(usePresentationPreferences, { wrapper });

		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(result.current.data).toEqual(preferences);
		expect(queryClient.getQueryData(presentationPreferencesQueryKey("account-a"))).toEqual(
			preferences,
		);
		expect(
			queryClient.getQueryData(presentationPreferencesQueryKey(preferences.profileId)),
		).toBeUndefined();
	});

	it("writes mutation results under the account cache identity", () => {
		const queryClient = new QueryClient();

		setPresentationPreferencesQueryData(queryClient, "account-a", response);

		expect(queryClient.getQueryData(presentationPreferencesQueryKey("account-a"))).toEqual(
			preferences,
		);
		expect(
			queryClient.getQueryData(presentationPreferencesQueryKey(preferences.profileId)),
		).toBeUndefined();
	});
});
