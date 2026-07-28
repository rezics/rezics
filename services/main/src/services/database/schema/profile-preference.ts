import { inArray, sql } from "drizzle-orm";
import { boolean, check, index, text, uuid } from "drizzle-orm/pg-core";
import type { PublicationLicenseId } from "@rezics/license";

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
	DefaultChineseContentDisplay,
	DefaultContentRatingValues,
	DefaultPreferredLanguage,
	DefaultStoredUiLocale,
	type StoredUiLocale,
	StoredUiLocaleValues,
} from "./contract-values";
import { contentRating, profile, resourceVisibility, unit } from "./core";

export const profilePreference = pgTable(
	"profile_preference",
	{
		profileId: uuid()
			.primaryKey()
			.references(() => profile.id, { onDelete: "cascade" }),
		defaultLicense: text().$type<PublicationLicenseId>(),
		defaultRealmManageMode: boolean().default(false).notNull(),
		defaultScoreContextUnitId: uuid().references(() => unit.id, { onDelete: "set null" }),
		scoreVisibility: resourceVisibility().default("private").notNull(),
		progressVisibility: resourceVisibility().default("private").notNull(),
		personalizedFeed: boolean().default(true).notNull(),
		filterFeedByPreferredLanguages: boolean().default(false).notNull(),
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
		index("profile_preference_default_score_context_unit_idx").on(
			table.defaultScoreContextUnitId,
		),
		check(
			"profile_preference_default_license_check",
			sql`${table.defaultLicense} is null or btrim(${table.defaultLicense}) <> ''`,
		),
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
