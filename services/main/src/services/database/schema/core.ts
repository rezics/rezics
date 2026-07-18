import { sql } from "drizzle-orm";
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
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import {
	AiDisclosureValues,
	CollaboratorRoleValues,
	ContentRatingValues,
	ContentStatusValues,
	DefaultLanguage,
	ImageAssetAccessValues,
	ImageAssetStatusValues,
	ModerationStatusValues,
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

export const unitKind = pgEnum("unit_kind", toEnumValues(UnitKindValues));
export const unitStatus = pgEnum("unit_status", toEnumValues(UnitStatusValues));
export const unitVisibility = pgEnum("unit_visibility", toEnumValues(UnitVisibilityValues));
export const contentRating = pgEnum("content_rating", toEnumValues(ContentRatingValues));
export const aiDisclosure = pgEnum("ai_disclosure", toEnumValues(AiDisclosureValues));
export const moderationStatus = pgEnum("moderation_status", toEnumValues(ModerationStatusValues));
export const contentStatus = pgEnum("content_status", toEnumValues(ContentStatusValues));
export const collaboratorRole = pgEnum("collaborator_role", toEnumValues(CollaboratorRoleValues));
export const imageAssetStatus = pgEnum("image_asset_status", toEnumValues(ImageAssetStatusValues));
export const imageAssetAccess = pgEnum("image_asset_access", toEnumValues(ImageAssetAccessValues));

export const unit = pgTable(
	"unit",
	{
		id: createUuidv7PrimaryKey(),
		kind: unitKind().notNull(),
		slug: text(),
		status: unitStatus().default("draft").notNull(),
		visibility: unitVisibility().default("public").notNull(),
		contentRating: contentRating().default("general").notNull(),
		aiDisclosure: aiDisclosure().default("unknown").notNull(),
		license: text(),
		moderationStatus: moderationStatus().default("approved").notNull(),
		publishedAt: createTimestampMsColumn(),
		deletedAt: createTimestampMsColumn(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		uniqueIndex("unit_kind_slug_key")
			.on(table.kind, table.slug)
			.where(sql`${table.slug} is not null`),
		index("unit_kind_status_created_at_idx")
			.on(table.kind, table.status, table.createdAt.desc(), table.id.desc())
			.where(sql`${table.deletedAt} is null`),
		index("unit_status_visibility_created_at_idx")
			.on(table.status, table.visibility, table.createdAt.desc(), table.id.desc())
			.where(sql`${table.deletedAt} is null`),
		index("unit_moderation_status_idx").on(table.moderationStatus),
		index("unit_slug_search_idx")
			.using("pgroonga", table.slug)
			.where(sql`${table.deletedAt} is null`),
		check("unit_slug_not_blank", sql`${table.slug} is null or btrim(${table.slug}) <> ''`),
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
		language: text().notNull(),
		/**
		 * Fractional index in the Unit's localization sequence. The first item is
		 * primary; fallback selection is one consumer of this general ordering.
		 */
		position: fractionalIndexPosition()
			.default(sql`('a0' || replace(uuidv7()::text, '-', '') || 'V')`)
			.notNull(),
		/** Cover is fixed product terminology across every Unit kind. */
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
		index("unit_localization_title_search_idx").using("pgroonga", table.title),
		index("unit_localization_summary_search_idx").using("pgroonga", table.summary),
		index("unit_localization_description_search_idx").using(
			"pgroonga",
			table.description.op("pgroonga_jsonb_full_text_search_ops_v2"),
		),
		index("unit_localization_content_search_idx").using(
			"pgroonga",
			table.content.op("pgroonga_jsonb_full_text_search_ops_v2"),
		),
		check(
			"unit_localization_language_check",
			sql`btrim(${table.language}) <> '' and char_length(${table.language}) <= 35`,
		),
		check(
			"unit_localization_value_check",
			sql`${table.title} is not null or ${table.summary} is not null or ${table.description} is not null or ${table.content} is not null`,
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
		avatarAssetId: uuid().references((): AnyPgColumn => imageAsset.id, {
			onDelete: "set null",
		}),
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
		defaultLicense: text(),
		defaultRealmManageMode: boolean().default(false).notNull(),
		personalizedFeed: boolean().default(true).notNull(),
		collectionConfig: createJsonObjectColumn(),
		contentRatings: contentRating()
			.array()
			.default(sql`array[]::content_rating[]`)
			.notNull(),
		preferredLanguages: text()
			.array()
			.default(sql.raw(`array['${DefaultLanguage}']::text[]`))
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
			sql`cardinality(${table.preferredLanguages}) > 0`,
		),
		createJsonObjectConstraint(
			"profile_preference_collection_config_json_object_check",
			table.collectionConfig,
		),
	],
);

export const unitCollaborator = pgTable(
	"unit_collaborator",
	{
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		profileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "cascade" }),
		role: collaboratorRole().notNull(),
		addedByProfileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "restrict" }),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.unitId, table.profileId] }),
		index("unit_collaborator_profile_role_idx").on(table.profileId, table.role),
		index("unit_collaborator_added_by_idx").on(table.addedByProfileId),
	],
);

export const unitFieldLock = pgTable(
	"unit_field_lock",
	{
		id: createUuidv7PrimaryKey(),
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		path: text().notNull(),
		lockedByProfileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "restrict" }),
		/** @UNIT_LOCALIZATION_EXEMPT Point-in-time administrative reason. */
		reason: text(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		unique("unit_field_lock_unit_path_key").on(table.unitId, table.path),
		index("unit_field_lock_locked_by_idx").on(table.lockedByProfileId),
		check("unit_field_lock_path_check", sql`${table.path} ~ '^/'`),
	],
);

export const profileFollow = pgTable(
	"profile_follow",
	{
		followerProfileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "cascade" }),
		followedProfileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "cascade" }),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.followerProfileId, table.followedProfileId] }),
		index("profile_follow_followed_created_at_idx").on(
			table.followedProfileId,
			table.createdAt.desc(),
			table.followerProfileId,
		),
		check(
			"profile_follow_not_self_check",
			sql`${table.followerProfileId} <> ${table.followedProfileId}`,
		),
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
