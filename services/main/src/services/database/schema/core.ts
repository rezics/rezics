import { inArray, sql } from "drizzle-orm";
import type { PublicationLicenseId } from "@rezics/license";
import {
	boolean,
	bigint,
	check,
	type AnyPgColumn,
	index,
	pgEnum,
	primaryKey,
	text,
	unique,
	uuid,
} from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import {
	AiDisclosureValues,
	type ContentLanguage,
	ContentRatingValues,
	ContentStatusValues,
	DefaultContentLanguage,
	DefaultStoredUiLocale,
	ImageAssetAccessValues,
	ImageAssetStatusValues,
	ModerationStatusValues,
	type StoredUiLocale,
	type UnitKind,
	UnitKindValues,
	UnitStatusValues,
	UnitVisibilityValues,
	toEnumValues,
} from "./contract-values";
import {
	createCreatedAtColumn,
	createJsonDocumentColumn,
	createJsonObjectColumn,
	createJsonObjectConstraint,
	createTimestampMsColumn,
	createUpdatedAtColumn,
	createUuidv7PrimaryKey,
	fractionalIndexPosition,
} from "./columns";
import { users } from "./auth";

export const unitStatus = pgEnum("unit_status", toEnumValues(UnitStatusValues));
export const unitVisibility = pgEnum("unit_visibility", toEnumValues(UnitVisibilityValues));
export const contentRating = pgEnum("content_rating", toEnumValues(ContentRatingValues));
export const aiDisclosure = pgEnum("ai_disclosure", toEnumValues(AiDisclosureValues));
export const moderationStatus = pgEnum("moderation_status", toEnumValues(ModerationStatusValues));
export const contentStatus = pgEnum("content_status", toEnumValues(ContentStatusValues));
export const imageAssetStatus = pgEnum("image_asset_status", toEnumValues(ImageAssetStatusValues));
export const imageAssetAccess = pgEnum("image_asset_access", toEnumValues(ImageAssetAccessValues));

export const unit = pgTable(
	"unit",
	{
		id: createUuidv7PrimaryKey(),
		kind: text().$type<UnitKind>().notNull(),
		status: unitStatus().default("draft").notNull(),
		visibility: unitVisibility().default("public").notNull(),
		contentRating: contentRating().default("general").notNull(),
		aiDisclosure: aiDisclosure().default("unknown").notNull(),
		/** Public-facing License selected for this Unit's work; never a grant to REZICS. */
		license: text().$type<PublicationLicenseId>(),
		moderationStatus: moderationStatus().default("approved").notNull(),
		/** Rejects creation of new Post relations that target this Unit. */
		postTargetingLocked: boolean().default(false).notNull(),
		publishedAt: createTimestampMsColumn(),
		deletedAt: createTimestampMsColumn(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		index("unit_kind_status_created_at_idx")
			.on(table.kind, table.status, table.createdAt.desc(), table.id.desc())
			.where(sql`${table.deletedAt} is null`),
		index("unit_status_visibility_created_at_idx")
			.on(table.status, table.visibility, table.createdAt.desc(), table.id.desc())
			.where(sql`${table.deletedAt} is null`),
		index("unit_moderation_status_idx").on(table.moderationStatus),
		unique("unit_id_kind_key").on(table.id, table.kind),
		check("unit_kind_check", inArray(table.kind, UnitKindValues)),
		check(
			"unit_publication_check",
			sql`${table.status} <> 'published'::unit_status or ${table.publishedAt} is not null`,
		),
		check(
			"unit_deleted_at_check",
			sql`${table.deletedAt} is null or ${table.deletedAt} >= ${table.createdAt}`,
		),
	],
);

export const unitLocalization = pgTable(
	"unit_localization",
	{
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		language: text().$type<ContentLanguage>().notNull(),
		/**
		 * Fractional index in the Unit's localization sequence. The first item is
		 * primary; fallback selection is one consumer of this general ordering.
		 */
		position: fractionalIndexPosition()
			.default(sql`('a0' || replace(uuidv7()::text, '-', '') || 'V')`)
			.notNull(),
		/** Compact identity artwork; fixed product terminology across every Unit kind. */
		avatarAssetId: uuid().references((): AnyPgColumn => imageAsset.id, {
			onDelete: "set null",
		}),
		/** Wide header artwork; fixed product terminology across every Unit kind. */
		bannerAssetId: uuid().references((): AnyPgColumn => imageAsset.id, {
			onDelete: "set null",
		}),
		/** Primary editorial artwork; fixed product terminology across every Unit kind. */
		coverAssetId: uuid().references((): AnyPgColumn => imageAsset.id, {
			onDelete: "set null",
		}),
		title: text(),
		summary: text(),
		description: createJsonDocumentColumn(),
		content: createJsonDocumentColumn(),
		contentStatus: contentStatus(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.unitId, table.language] }),
		unique("unit_localization_unit_position_key").on(table.unitId, table.position),
		index("unit_localization_unit_position_idx").on(
			table.unitId,
			table.position,
			table.language,
		),
		index("unit_localization_language_unit_idx").on(table.language, table.unitId),
		index("unit_localization_content_status_idx").on(table.contentStatus, table.updatedAt),
		check("unit_localization_language_check", sql`${table.language} in ('zh', 'en')`),
		check(
			"unit_localization_value_check",
			sql`${table.avatarAssetId} is not null or ${table.bannerAssetId} is not null or ${table.coverAssetId} is not null or ${table.title} is not null or ${table.summary} is not null or ${table.description} is not null or ${table.content} is not null`,
		),
		check(
			"unit_localization_content_state_check",
			sql`(${table.content} is null) = (${table.contentStatus} is null)`,
		),
	],
);

export const profile = pgTable(
	"profile",
	{
		id: uuid()
			.primaryKey()
			.references(() => unit.id, { onDelete: "cascade" }),
		authUserId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		joinedAt: createTimestampMsColumn().defaultNow().notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [unique("profile_auth_user_id_key").on(table.authUserId)],
);

/** Stable logical identity for one immutable image content version. */
export const imageAsset = pgTable(
	"image_asset",
	{
		id: createUuidv7PrimaryKey(),
		uploaderProfileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "restrict" }),
		ownerProfileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "restrict" }),
		status: imageAssetStatus().default("pending").notNull(),
		access: imageAssetAccess().default("private").notNull(),
		deletedAt: createTimestampMsColumn(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		index("image_asset_uploader_status_idx").on(
			table.uploaderProfileId,
			table.status,
			table.createdAt,
		),
		index("image_asset_owner_status_idx").on(
			table.ownerProfileId,
			table.status,
			table.createdAt,
		),
		check(
			"image_asset_deleted_at_check",
			sql`${table.deletedAt} is null or ${table.deletedAt} >= ${table.createdAt}`,
		),
	],
);

/** Physical object backing an image asset; V1 permits exactly one object per asset. */
export const imageObject = pgTable(
	"image_object",
	{
		id: createUuidv7PrimaryKey(),
		assetId: uuid()
			.notNull()
			.references(() => imageAsset.id, { onDelete: "cascade" }),
		storageKey: text().notNull(),
		mediaType: text(),
		byteSize: bigint({ mode: "number" }),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		unique("image_object_asset_id_key").on(table.assetId),
		unique("image_object_storage_key_key").on(table.storageKey),
		check("image_object_storage_key_not_blank", sql`btrim(${table.storageKey}) <> ''`),
		check(
			"image_object_metadata_shape_check",
			sql`(${table.mediaType} is null and ${table.byteSize} is null) or (${table.mediaType} is not null and ${table.byteSize} > 0)`,
		),
	],
);

export const profilePreference = pgTable(
	"profile_preference",
	{
		profileId: uuid()
			.primaryKey()
			.references(() => profile.id, { onDelete: "cascade" }),
		defaultLicense: text().$type<PublicationLicenseId>(),
		defaultRealmManageMode: boolean().default(false).notNull(),
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

/**
 * A Profile's one-way interest relation to a Unit and the source of truth for
 * follow state.
 *
 * This relation does not enable notification delivery channels or define which
 * activities are surfaced to followers.
 *
 * @todo Classify every UnitKind as followable or internal-only, and define the
 * follower-visible activity set for every followable kind. For example, define
 * which Book updates are surfaced to its followers. Keep per-follow notification
 * preferences separate from this relation.
 */
export const unitFollow = pgTable(
	"unit_follow",
	{
		followerProfileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "cascade" }),
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		position: fractionalIndexPosition()
			.default(sql`'a0' || replace(uuidv7()::text, '-', '') || 'V'`)
			.notNull(),
		favorite: boolean().default(false).notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.followerProfileId, table.unitId] }),
		index("unit_follow_follower_favorite_position_idx").on(
			table.followerProfileId,
			table.favorite.desc(),
			table.position,
			table.unitId,
		),
		index("unit_follow_unit_created_at_idx").on(
			table.unitId,
			table.createdAt.desc(),
			table.followerProfileId,
		),
		check("unit_follow_not_self_check", sql`${table.followerProfileId} <> ${table.unitId}`),
	],
);

export const profileBlock = pgTable(
	"profile_block",
	{
		blockerProfileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "cascade" }),
		blockedProfileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "cascade" }),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.blockerProfileId, table.blockedProfileId] }),
		index("profile_block_blocked_idx").on(table.blockedProfileId),
		check(
			"profile_block_not_self_check",
			sql`${table.blockerProfileId} <> ${table.blockedProfileId}`,
		),
	],
);
