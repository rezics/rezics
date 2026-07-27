import { Check } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import { FollowingStatusResponse } from "../schema/action-response";
import {
	CollectionConfigV1,
	FollowingListQuery,
	PublicProfileQuery,
	ReplacePreferencesBody,
	StudioContentListQuery,
	UpdateInterfaceLocaleBody,
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
		expect(Check(FollowingListQuery, { language: "zh" })).toBe(false);
		expect(Check(FollowingListQuery, { localizationLanguages: ["zh-Hant"] })).toBe(false);
		expect(Check(FollowingListQuery, { limit: 101 })).toBe(false);
	});

	it("keeps followed and not-followed presentation states discriminated", () => {
		expect(
			Check(FollowingStatusResponse, {
				following: true,
				favorite: false,
				position: "a0V",
			}),
		).toBe(true);
		expect(
			Check(FollowingStatusResponse, {
				following: false,
				favorite: null,
				position: null,
			}),
		).toBe(true);
		expect(
			Check(FollowingStatusResponse, {
				following: false,
				favorite: false,
				position: "a0V",
			}),
		).toBe(false);
	});
});

describe("public profile localization query", () => {
	it("accepts one ordered content-language list only", () => {
		expect(Check(PublicProfileQuery, {})).toBe(true);
		expect(Check(PublicProfileQuery, { localizationLanguages: ["zh", "en"] })).toBe(true);
		expect(Check(PublicProfileQuery, { localizationLanguages: [] })).toBe(false);
		expect(Check(PublicProfileQuery, { localizationLanguages: ["en", "en"] })).toBe(false);
		expect(Check(PublicProfileQuery, { language: "en" })).toBe(false);
	});
});

describe("Studio content list contract", () => {
	it("accepts only supported sections and bounded limits", () => {
		expect(Check(StudioContentListQuery, { section: "book" })).toBe(true);
		expect(StudioContentListQuery.properties.view.default).toBe("all");
		expect(StudioContentListQuery.properties.sort.default).toBe("recent");
		expect(StudioContentListQuery.properties.permission.default).toBeUndefined();
		expect(StudioContentListQuery.properties.workState.default).toBeUndefined();
		expect(StudioContentListQuery.properties.status.default).toBeUndefined();
		expect(StudioContentListQuery.properties.visibility.default).toBeUndefined();
		expect(
			Check(StudioContentListQuery, {
				section: "wiki",
				view: "contributed",
				permission: "unit.update",
				workState: "actionable",
				status: "published",
				visibility: "public",
				sort: "recent",
				localizationLanguages: ["zh", "en"],
				cursor: "opaque",
				limit: 100,
			}),
		).toBe(true);
		expect(Check(StudioContentListQuery, { section: "zone" })).toBe(true);
		expect(Check(StudioContentListQuery, { section: "unknown" })).toBe(false);
		expect(Check(StudioContentListQuery, { section: "book", view: "mine" })).toBe(false);
		expect(
			Check(StudioContentListQuery, {
				section: "book",
				permission: "unit.delete",
			}),
		).toBe(false);
		expect(Check(StudioContentListQuery, { section: "book", limit: 101 })).toBe(false);
	});
});

describe("user preference inputs", () => {
	it("accepts only a supported interface locale in the partial update", () => {
		expect(Check(UpdateInterfaceLocaleBody, { interfaceLocale: "en" })).toBe(true);
		expect(Check(UpdateInterfaceLocaleBody, { interfaceLocale: "zh-hant" })).toBe(true);
		expect(Check(UpdateInterfaceLocaleBody, { interfaceLocale: "fr" })).toBe(false);
		expect(
			Check(UpdateInterfaceLocaleBody, {
				interfaceLocale: "en",
				preferredLanguages: ["en"],
			}),
		).toBe(false);
	});

	it("accepts only registered default publication License IDs", () => {
		const preferences = {
			interfaceLocale: "en",
			defaultLicense: "cc-by-nc-sa-4.0",
			defaultRealmManageMode: false,
			defaultScoreContextUnitId: "019b76da-a800-7300-8000-000000000002",
			collectionConfig: null,
			personalizedFeed: true,
			filterFeedByPreferredLanguages: false,
			contentRatings: ["general"],
			preferredLanguages: ["en"],
		};
		expect(Check(ReplacePreferencesBody, preferences)).toBe(true);
		expect(
			Check(ReplacePreferencesBody, { ...preferences, defaultLicense: "custom terms" }),
		).toBe(false);
	});
});
