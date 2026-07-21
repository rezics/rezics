import { Check } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import { FollowingStatusResponse } from "../schema/action-response";
import {
	CollectionConfigV1,
	FollowingListQuery,
	ReplacePreferencesBody,
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
		expect(Check(FollowingListQuery, { kind: "zone", language: "zh", limit: 30 })).toBe(true);
		expect(Check(FollowingListQuery, { kind: "unknown" })).toBe(false);
		expect(Check(FollowingListQuery, { language: "zh-Hant" })).toBe(false);
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
			collectionConfig: null,
			personalizedFeed: true,
			contentRatings: ["general"],
			preferredLanguages: ["en"],
		};
		expect(Check(ReplacePreferencesBody, preferences)).toBe(true);
		expect(
			Check(ReplacePreferencesBody, { ...preferences, defaultLicense: "custom terms" }),
		).toBe(false);
	});
});
