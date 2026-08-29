import { describe, expect, it } from "vitest";

import {
	parsePresentationPreferences,
	presentationPreferencesQueryKey,
} from "./presentation-preferences";

describe("presentation preferences", () => {
	it("parses only the presentation fields from the full preferences response", () => {
		expect(
			parsePresentationPreferences({
				profileId: "00000000-0000-4000-8000-000000000001",
				interfaceLocale: "zh-Hant",
				chineseContentDisplay: "original",
				filterFeedByPreferredLanguages: true,
				alwaysShowSpoilers: false,
				alwaysShowNsfw: true,
				customThemesEnabled: false,
				preferredLanguages: ["en", "zh"],
				unrelatedPreference: "ignored",
			}),
		).toEqual({
			profileId: "00000000-0000-4000-8000-000000000001",
			interfaceLocale: "zh-Hant",
			chineseContentDisplay: "original",
			filterFeedByPreferredLanguages: true,
			alwaysShowSpoilers: false,
			alwaysShowNsfw: true,
			customThemesEnabled: false,
			preferredLanguages: ["en", "zh"],
		});
	});

	it("rejects unsupported and duplicate language priorities", () => {
		const base = {
			profileId: "00000000-0000-4000-8000-000000000001",
			interfaceLocale: "en",
			chineseContentDisplay: "original",
			filterFeedByPreferredLanguages: false,
			alwaysShowSpoilers: false,
			alwaysShowNsfw: false,
			customThemesEnabled: true,
		};

		expect(parsePresentationPreferences({ ...base, preferredLanguages: ["pt"] })).toBeUndefined();
		expect(
			parsePresentationPreferences({ ...base, preferredLanguages: ["en", "en"] }),
		).toBeUndefined();
	});

	it("scopes the cache key to the authenticated account", () => {
		expect(presentationPreferencesQueryKey("account-a")).not.toEqual(
			presentationPreferencesQueryKey("account-b"),
		);
	});
});
