import { describe, expect, it } from "vitest";

import { resolveUnitLocalizationImageAssetIdFromOrdered } from "./localization";

const localizations = [
	{
		language: "en",
		avatarAssetId: "avatar-default",
		bannerAssetId: "banner-default",
		coverAssetId: null,
	},
	{
		language: "zh",
		avatarAssetId: "avatar-zh",
		bannerAssetId: null,
		coverAssetId: "cover-zh",
	},
] as const;

describe("resolveUnitLocalizationImageAssetIdFromOrdered", () => {
	it("prefers a requested localization override", () => {
		expect(resolveUnitLocalizationImageAssetIdFromOrdered(localizations, "avatar", "zh")).toBe(
			"avatar-zh",
		);
	});

	it("inherits the first available asset when the requested localization is empty", () => {
		expect(resolveUnitLocalizationImageAssetIdFromOrdered(localizations, "banner", "zh")).toBe(
			"banner-default",
		);
	});

	it("falls forward when the primary localization has no asset", () => {
		expect(resolveUnitLocalizationImageAssetIdFromOrdered(localizations, "cover")).toBe(
			"cover-zh",
		);
	});

	it("returns null when no localization defines the role", () => {
		expect(
			resolveUnitLocalizationImageAssetIdFromOrdered(
				localizations.map((localization) => ({ ...localization, coverAssetId: null })),
				"cover",
			),
		).toBeNull();
	});
});
