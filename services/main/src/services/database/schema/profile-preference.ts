import { sql } from "drizzle-orm";
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
	type ContentLanguage,
	DefaultContentLanguage,
	DefaultStoredUiLocale,
	type StoredUiLocale,
} from "./contract-values";
import { contentRating, profile } from "./core";
import { realm } from "./realm";

export const profilePreference = pgTable(
	"profile_preference",
	{
		profileId: uuid()
			.primaryKey()
			.references(() => profile.id, { onDelete: "cascade" }),
		defaultLicense: text().$type<PublicationLicenseId>(),
		defaultRealmManageMode: boolean().default(false).notNull(),
		defaultScoreRealmId: uuid().references(() => realm.id, { onDelete: "set null" }),
		personalizedFeed: boolean().default(true).notNull(),
		collectionConfig: createJsonObjectColumn(),
		interfaceLocale: text().$type<StoredUiLocale>().default(DefaultStoredUiLocale).notNull(),
		contentRatings: contentRating()
			.array()
			.default(sql`array[]::content_rating[]`)
			.notNull(),
		preferredLanguages: text()
			.$type<ContentLanguage>()
			.array()
			.default(sql.raw(`array['${DefaultContentLanguage}']::text[]`))
			.notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		index("profile_preference_default_score_realm_idx").on(table.defaultScoreRealmId),
		check(
			"profile_preference_default_license_check",
			sql`${table.defaultLicense} is null or btrim(${table.defaultLicense}) <> ''`,
		),
		check(
			"profile_preference_languages_check",
			sql`cardinality(${table.preferredLanguages}) > 0
				and ${table.preferredLanguages} <@ array['zh', 'en']::text[]
				and cardinality(array_positions(${table.preferredLanguages}, 'zh')) <= 1
				and cardinality(array_positions(${table.preferredLanguages}, 'en')) <= 1`,
		),
		check(
			"profile_preference_interface_locale_check",
			sql`${table.interfaceLocale} in ('en', 'zh-hant')`,
		),
		createJsonObjectConstraint(
			"profile_preference_collection_config_json_object_check",
			table.collectionConfig,
		),
	],
);
