import { Check } from "typebox/value";
import { describe, expect, it } from "vitest";

import { FollowingStatusResponse } from "../schema/action-response";
import {
	CollectionConfigV1,
	FollowingListQuery,
	ProfileActivityQuery,
	PublicProfileQuery,
	ReplaceFollowingSettingsBody,
	ReplacePreferencesBody,
	StudioContentListQuery,
	UpdateDisplayPreferencesBody,
	UpdatePrivacyPreferencesBody,
	UpdateProfileBody,
} from "./schema";

describe("Collection preference contract", () => {
	it("version-controls the Main-with-Variant default", () => {
		expect(
			Check(CollectionConfigV1, {
				version: 1,
				view: "grid",
				addMainWithVariantByDefault: true,
			}),
		).toBe(true);
		expect(Check(CollectionConfigV1, { view: "grid" })).toBe(false);
		expect(Check(CollectionConfigV1, { version: 2 })).toBe(false);
		expect(Check(CollectionConfigV1, { version: 1, unknown: true })).toBe(false);
	});
});

describe("following API contracts", () => {
	it("accepts typed kind, language, and bounded pagination inputs", () => {
		expect(
			Check(FollowingListQuery, {
				kind: "zone",
				localizationLanguages: ["zh", "en"],
				limit: 30,
			}),
		).toBe(true);
		expect(Check(FollowingListQuery, { kind: "unknown" })).toBe(false);
		expect(Check(FollowingListQuery, { kind: "tag_path" })).toBe(false);
		expect(Check(FollowingListQuery, { language: "zh" })).toBe(false);
		expect(Check(FollowingListQuery, { localizationLanguages: ["zh-Hant"] })).toBe(false);
		expect(Check(FollowingListQuery, { limit: 101 })).toBe(false);
	});

	it("keeps followed and not-followed presentation states discriminated", () => {
		expect(
			Check(FollowingStatusResponse, {
				following: true,
				kind: "realm",
				favorite: false,
				position: "a0V",
				inAppNotificationsEnabled: true,
				realmTagSourceSubscribed: false,
			}),
		).toBe(true);
		expect(
			Check(FollowingStatusResponse, {
				following: false,
				kind: "book",
				favorite: null,
				position: null,
				inAppNotificationsEnabled: null,
				realmTagSourceSubscribed: null,
			}),
		).toBe(true);
		expect(
			Check(FollowingStatusResponse, {
				following: false,
				kind: "realm",
				favorite: false,
				position: "a0V",
				inAppNotificationsEnabled: null,
				realmTagSourceSubscribed: true,
			}),
		).toBe(false);
		expect(
			Check(FollowingStatusResponse, {
				following: true,
				kind: "book",
				favorite: false,
				position: "a0V",
				inAppNotificationsEnabled: true,
				realmTagSourceSubscribed: true,
			}),
		).toBe(false);
	});

	it("requires Realm-only personalization settings only for Realm targets", () => {
		expect(
			Check(ReplaceFollowingSettingsBody, {
				kind: "realm",
				inAppNotificationsEnabled: false,
				realmTagSourceSubscribed: true,
			}),
		).toBe(true);
		expect(
			Check(ReplaceFollowingSettingsBody, {
				kind: "tag_path",
				inAppNotificationsEnabled: true,
				realmTagSourceSubscribed: null,
			}),
		).toBe(false);
		expect(
			Check(ReplaceFollowingSettingsBody, {
				kind: "book",
				inAppNotificationsEnabled: true,
				realmTagSourceSubscribed: null,
			}),
		).toBe(true);
		expect(
			Check(ReplaceFollowingSettingsBody, {
				kind: "book",
				inAppNotificationsEnabled: true,
				realmTagSourceSubscribed: false,
			}),
		).toBe(false);
	});
});

describe("public profile localization query", () => {
	it("accepts one ordered content-language list only", () => {
		expect(Check(PublicProfileQuery, {})).toBe(true);
		expect(Check(PublicProfileQuery, { localizationLanguages: ["zh", "en"] })).toBe(true);
		expect(Check(PublicProfileQuery, { localizationLanguages: [] })).toBe(true);
		expect(Check(PublicProfileQuery, { localizationLanguages: ["en", "en"] })).toBe(false);
		expect(Check(PublicProfileQuery, { language: "en" })).toBe(false);
	});
});

describe("Profile privacy contracts", () => {
	it("accepts only explicit Score and Progress category visibility controls", () => {
		expect(
			Check(UpdatePrivacyPreferencesBody, {
				scoreVisibility: "private",
				progressVisibility: "unlisted",
			}),
		).toBe(true);
		expect(Check(UpdatePrivacyPreferencesBody, { scoreVisibility: "public" })).toBe(true);
		expect(Check(UpdatePrivacyPreferencesBody, {})).toBe(false);
		expect(Check(UpdatePrivacyPreferencesBody, { scoreVisibility: "followers" })).toBe(false);
		expect(Check(UpdatePrivacyPreferencesBody, { unitVisibility: "private" })).toBe(false);
	});

	it("bounds public Profile activity reads", () => {
		expect(
			Check(ProfileActivityQuery, {
				localizationLanguages: ["zh", "en"],
				limit: 20,
			}),
		).toBe(true);
		expect(Check(ProfileActivityQuery, { limit: 0 })).toBe(false);
		expect(Check(ProfileActivityQuery, { limit: 51 })).toBe(false);
	});
});

describe("profile content language contract", () => {
	it("requires one supported language for every localized profile update", () => {
		const input = {
			updatedAt: "2026-07-28T00:00:00.000Z",
			language: "zh",
			name: "名稱",
		};
		expect(Check(UpdateProfileBody, input)).toBe(true);
		expect(Check(UpdateProfileBody, { ...input, language: "ja" })).toBe(true);
		expect(Check(UpdateProfileBody, { ...input, language: "zh-Hans" })).toBe(false);
		expect(
			Check(UpdateProfileBody, {
				updatedAt: input.updatedAt,
				name: input.name,
			}),
		).toBe(false);
	});
});

describe("Studio content list contract", () => {
	it("accepts only supported sections and bounded limits", () => {
		expect(Check(StudioContentListQuery, {})).toBe(true);
		expect(Check(StudioContentListQuery, { section: "book" })).toBe(true);
		expect(StudioContentListQuery.properties.source).toHaveProperty("default", "all");
		expect(Reflect.get(StudioContentListQuery.properties.status, "default")).toBeUndefined();
		expect(Reflect.get(StudioContentListQuery.properties.visibility, "default")).toBeUndefined();
		expect(
			Check(StudioContentListQuery, {
				section: "wiki",
				source: "direct",
				status: "published",
				visibility: "public",
				localizationLanguages: ["zh", "en"],
				cursor: "opaque",
				limit: 100,
			}),
		).toBe(true);
		expect(Check(StudioContentListQuery, { section: "zone" })).toBe(true);
		expect(Check(StudioContentListQuery, { section: "unknown" })).toBe(false);
		expect(Check(StudioContentListQuery, { section: "book", source: "created" })).toBe(false);
		expect(Check(StudioContentListQuery, { section: "book", view: "contributed" })).toBe(false);
		expect(Check(StudioContentListQuery, { section: "book", limit: 101 })).toBe(false);
	});
});

describe("user preference inputs", () => {
	it("accepts supported display preferences in partial updates", () => {
		expect(Check(UpdateDisplayPreferencesBody, { interfaceLocale: "en" })).toBe(true);
		expect(Check(UpdateDisplayPreferencesBody, { interfaceLocale: "zh-Hant" })).toBe(true);
		expect(Check(UpdateDisplayPreferencesBody, { interfaceLocale: "zh-Hans" })).toBe(true);
		expect(Check(UpdateDisplayPreferencesBody, { interfaceLocale: "fr" })).toBe(true);
		expect(Check(UpdateDisplayPreferencesBody, { chineseContentDisplay: "hans" })).toBe(true);
		expect(Check(UpdateDisplayPreferencesBody, {})).toBe(false);
		expect(Check(UpdateDisplayPreferencesBody, { interfaceLocale: "zh-hant" })).toBe(false);
		expect(
			Check(UpdateDisplayPreferencesBody, {
				interfaceLocale: "en",
				preferredLanguages: ["en"],
			}),
		).toBe(false);
	});

	it("accepts only registered default License IDs", () => {
		const preferences = {
			interfaceLocale: "en",
			chineseContentDisplay: "original",
			defaultLicenses: ["cc-by-nc-sa-4.0"],
			defaultRealmManageMode: false,
			defaultScoreRealmId: "019b76da-a800-7300-8000-000000000002",
			collectionConfig: null,
			personalizedFeed: true,
			customThemesEnabled: true,
			filterFeedByPreferredLanguages: false,
			alwaysShowSpoilers: false,
			alwaysShowNsfw: false,
			contentRatings: ["general"],
			preferredLanguages: ["en"],
		};
		expect(Check(ReplacePreferencesBody, preferences)).toBe(true);
		expect(
			Check(ReplacePreferencesBody, {
				...preferences,
				defaultLicenses: ["cc-by-nc-sa-4.0", "rezics-unit-content-license-v1-1"],
			}),
		).toBe(true);
		expect(
			Check(ReplacePreferencesBody, {
				...preferences,
				defaultLicenses: ["cc-by-nc-sa-4.0", "cc-by-nc-sa-4.0"],
			}),
		).toBe(false);
		expect(Check(ReplacePreferencesBody, { ...preferences, contentRatings: [] })).toBe(false);
		expect(
			Check(ReplacePreferencesBody, { ...preferences, defaultLicenses: ["custom terms"] }),
		).toBe(false);
	});
});
