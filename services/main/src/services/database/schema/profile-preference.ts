import { inArray, sql } from "drizzle-orm";
import { boolean, check, index, text, uuid } from "drizzle-orm/pg-core";
import type { LicenseId } from "@rezics/license";

import { pgTable } from "./base";
import {
	createCreatedAtColumn,
	createJsonObjectColumn,
	createJsonObjectConstraint,
	createUpdatedAtColumn,
} from "./columns";
import {
	type ChineseContentDisplay,
	ChineseContentDisplayValues,
	type ContentLanguage,
	ContentLanguageValues,
	DefaultResourceVisibility,
	DefaultChineseContentDisplay,
	DefaultContentRatingValues,
	DefaultPreferredLanguage,
	DefaultStoredUiLocale,
	type StoredUiLocale,
	StoredUiLocaleValues,
} from "./contract-values";
import { profile } from "./profile";
import { contentRating, resourceVisibility } from "./unit";
import { realm } from "./realm";

export const profilePreference = pgTable(
	"profile_preference",
	{
		profileId: uuid()
			.primaryKey()
			.references(() => profile.id, { onDelete: "cascade" }),
		defaultLicenses: text().$type<LicenseId>().array().default(sql`'{}'::text[]`).notNull(),
		defaultRealmManageMode: boolean().default(false).notNull(),
		defaultScoreRealmId: uuid().references(() => realm.id, { onDelete: "set null" }),
		scoreVisibility: resourceVisibility().default(DefaultResourceVisibility).notNull(),
		progressVisibility: resourceVisibility().default(DefaultResourceVisibility).notNull(),
		personalizedFeed: boolean().default(true).notNull(),
		filterFeedByPreferredLanguages: boolean().default(false).notNull(),
		alwaysShowSpoilers: boolean().default(false).notNull(),
		alwaysShowNsfw: boolean().default(false).notNull(),
		collectionConfig: createJsonObjectColumn(),
		interfaceLocale: text().$type<StoredUiLocale>().default(DefaultStoredUiLocale).notNull(),
		chineseContentDisplay: text()
			.$type<ChineseContentDisplay>()
			.default(DefaultChineseContentDisplay)
			.notNull(),
		contentRatings: contentRating()
			.array()
			.default(
				sql.raw(
					`array[${DefaultContentRatingValues.map((value) => `'${value}'`).join(", ")}]::content_rating[]`,
				),
			)
			.notNull(),
		preferredLanguages: text()
			.$type<ContentLanguage>()
			.array()
			.default(sql.raw(`array['${DefaultPreferredLanguage}']::text[]`))
			.notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		index("profile_preference_default_score_realm_idx").on(table.defaultScoreRealmId),
		check(
			"profile_preference_languages_check",
			sql`cardinality(${table.preferredLanguages}) > 0
				and ${table.preferredLanguages} <@ array[${sql.join(
					ContentLanguageValues.map((language) => sql`${language}`),
					sql`, `,
				)}]::text[]
				and ${sql.join(
					ContentLanguageValues.map(
						(language) =>
							sql`cardinality(array_positions(${table.preferredLanguages}, ${language})) <= 1`,
					),
					sql` and `,
				)}`,
		),
		check(
			"profile_preference_content_ratings_check",
			sql`cardinality(${table.contentRatings}) > 0`,
		),
		check(
			"profile_preference_interface_locale_check",
			inArray(table.interfaceLocale, StoredUiLocaleValues),
		),
		check(
			"profile_preference_chinese_content_display_check",
			inArray(table.chineseContentDisplay, ChineseContentDisplayValues),
		),
		createJsonObjectConstraint(
			"profile_preference_collection_config_json_object_check",
			table.collectionConfig,
		),
	],
);
