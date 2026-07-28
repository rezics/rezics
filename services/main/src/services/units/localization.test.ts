import { PgDialect } from "drizzle-orm/pg-core";
import { FontAwesomeProvider } from "@rezics/avatar";
import { describe, expect, it } from "vitest";

import { unit } from "../database/schema";
import {
	avatarReferenceToColumns,
	resolveUnitLocalizationFromOrdered,
	resolveUnitLocalizationAvatarFromOrdered,
	resolveUnitLocalizationImageAssetIdFromOrdered,
	resolvedUnitLocalizationAvatar,
	resolvedUnitLocalizationTitle,
	toUnitLocalizationStorage,
} from "./localization";

const localizations = [
	{
		language: "en",
		avatarType: "image",
		avatarAssetId: "avatar-default",
		avatarEmoji: null,
		avatarIconPrefix: null,
		avatarIconName: null,
		bannerAssetId: "banner-default",
		coverAssetId: null,
	},
	{
		language: "zh",
		avatarType: "emoji",
		avatarAssetId: null,
		avatarEmoji: "🦈",
		avatarIconPrefix: null,
		avatarIconName: null,
		bannerAssetId: null,
		coverAssetId: "cover-zh",
	},
] as const;

describe("resolveUnitLocalizationFromOrdered", () => {
	it("matches the ordered language query against the ordered Unit localization list", () => {
		expect(resolveUnitLocalizationFromOrdered(localizations, ["zh", "en"])?.language).toBe(
			"zh",
		);
		expect(resolveUnitLocalizationFromOrdered(localizations, ["en", "zh"])?.language).toBe(
			"en",
		);
	});

	it("falls back to the Unit's position-language order when the query has no match", () => {
		expect(resolveUnitLocalizationFromOrdered([localizations[0]], ["zh"])?.language).toBe("en");
		expect(resolveUnitLocalizationFromOrdered(localizations, [])?.language).toBe("en");
	});
});

describe("resolveUnitLocalizationAvatarFromOrdered", () => {
	it("prefers a requested localization override as one complete union value", () => {
		expect(resolveUnitLocalizationAvatarFromOrdered(localizations, ["zh"])).toEqual({
			type: "emoji",
			emoji: "🦈",
		});
	});

	it("inherits the first complete avatar when the requested localization is empty", () => {
		expect(
			resolveUnitLocalizationAvatarFromOrdered(
				localizations.map((localization) =>
					localization.language === "zh"
						? { ...localization, avatarType: null, avatarEmoji: null }
						: localization,
				),
				["zh"],
			),
		).toEqual({ type: "image", image: { assetId: "avatar-default" } });
	});
});

describe("resolvedUnitLocalizationAvatar", () => {
	it("gives the bound provider value a concrete PostgreSQL type", () => {
		const query = new PgDialect().sqlToQuery(resolvedUnitLocalizationAvatar(unit.id));

		expect(query.sql).toContain("'provider', $1::text");
		expect(query.params[0]).toBe(FontAwesomeProvider);
	});

	it("preserves the caller's language preference order for array filters", () => {
		const query = new PgDialect().sqlToQuery(
			resolvedUnitLocalizationTitle(unit.id, ["zh", "en"]),
		);

		expect(query.sql).toContain("array_position");
		expect(query.sql).toContain("array[$1, $2]::text[]");
		expect(query.params).toEqual(["zh", "en", 3]);
	});
});

describe("avatar storage", () => {
	it("writes exactly one payload for each discriminated variant", () => {
		expect(avatarReferenceToColumns({ type: "emoji", emoji: "🦈" })).toEqual({
			avatarType: "emoji",
			avatarAssetId: null,
			avatarEmoji: "🦈",
			avatarIconPrefix: null,
			avatarIconName: null,
		});
		expect(
			avatarReferenceToColumns({
				type: "icon",
				icon: { provider: "font-awesome", prefix: "fab", name: "500px" },
			}),
		).toEqual({
			avatarType: "icon",
			avatarAssetId: null,
			avatarEmoji: null,
			avatarIconPrefix: "fab",
			avatarIconName: "500px",
		});
	});

	it("distinguishes omitted avatar updates from an explicit removal", () => {
		expect(toUnitLocalizationStorage({ title: "Unchanged" })).toEqual({
			title: "Unchanged",
		});
		expect(toUnitLocalizationStorage({ title: "Removed", avatar: null })).toEqual({
			title: "Removed",
			avatarType: null,
			avatarAssetId: null,
			avatarEmoji: null,
			avatarIconPrefix: null,
			avatarIconName: null,
		});
	});
});

describe("resolveUnitLocalizationImageAssetIdFromOrdered", () => {
	it("inherits the first available asset when the requested localization is empty", () => {
		expect(
			resolveUnitLocalizationImageAssetIdFromOrdered(localizations, "banner", ["zh"]),
		).toBe("banner-default");
	});

	it("falls forward when the first fallback localization has no asset", () => {
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
