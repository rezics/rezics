import { inArray, sql } from "drizzle-orm";
import {
	AvatarTypeValues,
	FontAwesomeIconNamePatternSource,
	FontAwesomeIconPrefixValues,
	type AvatarType,
	type FontAwesomeIconPrefix,
} from "@rezics/avatar";
import type { PublicationLicenseId } from "@rezics/license";
import {
	boolean,
	bigint,
	check,
	doublePrecision,
	type AnyPgColumn,
	index,
	integer,
	pgEnum,
	primaryKey,
	text,
	unique,
	uuid,
} from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import {
	AiDisclosureValues,
	CatalogEntryModeValues,
	type CatalogEntryMode,
	type ContentLanguage,
	ContentLanguageValues,
	ContentRatingValues,
	ContentStatusValues,
	ImageAssetAccessValues,
	ImageAssetPresentationFitValues,
	ImageAssetPresentationRoleValues,
	ImageAssetStatusValues,
	ModerationStatusValues,
	type UnitKind,
	UnitKindValues,
	UnitStatusValues,
	ResourceVisibilityValues,
	toEnumValues,
} from "./contract-values";
import {
	createCreatedAtColumn,
	createJsonDocumentColumn,
	createTimestampMsColumn,
	createUpdatedAtColumn,
	createUuidv7PrimaryKey,
	fractionalIndexPosition,
} from "./columns";
import { users } from "./auth";

export const unitStatus = pgEnum("unit_status", toEnumValues(UnitStatusValues));
export const resourceVisibility = pgEnum(
	"resource_visibility",
	toEnumValues(ResourceVisibilityValues),
);
export const contentRating = pgEnum("content_rating", toEnumValues(ContentRatingValues));
export const aiDisclosure = pgEnum("ai_disclosure", toEnumValues(AiDisclosureValues));
export const moderationStatus = pgEnum("moderation_status", toEnumValues(ModerationStatusValues));
export const contentStatus = pgEnum("content_status", toEnumValues(ContentStatusValues));
export const imageAssetStatus = pgEnum("image_asset_status", toEnumValues(ImageAssetStatusValues));
export const imageAssetAccess = pgEnum("image_asset_access", toEnumValues(ImageAssetAccessValues));
export const imageAssetPresentationRole = pgEnum(
	"image_asset_presentation_role",
	toEnumValues(ImageAssetPresentationRoleValues),
);
export const imageAssetPresentationFit = pgEnum(
	"image_asset_presentation_fit",
	toEnumValues(ImageAssetPresentationFitValues),
);

export const unit = pgTable(
	"unit",
	{
		id: createUuidv7PrimaryKey(),
		kind: text().$type<UnitKind>().notNull(),
		catalogMode: text().$type<CatalogEntryMode>().default("owned_work").notNull(),
		status: unitStatus().default("draft").notNull(),
		visibility: resourceVisibility().default("public").notNull(),
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
		check("unit_catalog_mode_check", inArray(table.catalogMode, CatalogEntryModeValues)),
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
		 * Fractional index in the Unit's content-language fallback sequence.
		 * Reader preferences are resolved first; this order is used only when no
		 * requested language is available.
		 */
		position: fractionalIndexPosition()
			.default(sql`('a0' || replace(uuidv7()::text, '-', '') || 'V')`)
			.notNull(),
		/** Compact identity artwork; fixed product terminology across every Unit kind. */
		avatarType: text().$type<AvatarType>(),
		avatarAssetId: uuid().references((): AnyPgColumn => imageAsset.id, {
			onDelete: "restrict",
		}),
		avatarEmoji: text(),
		avatarIconPrefix: text().$type<FontAwesomeIconPrefix>(),
		avatarIconName: text(),
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
		check("unit_localization_language_check", inArray(table.language, ContentLanguageValues)),
		check("unit_localization_avatar_type_check", inArray(table.avatarType, AvatarTypeValues)),
		check(
			"unit_localization_avatar_value_check",
			sql`(
				${table.avatarType} is null
				and ${table.avatarAssetId} is null
				and ${table.avatarEmoji} is null
				and ${table.avatarIconPrefix} is null
				and ${table.avatarIconName} is null
			) or (
				${table.avatarType} = 'image'
				and ${table.avatarAssetId} is not null
				and ${table.avatarEmoji} is null
				and ${table.avatarIconPrefix} is null
				and ${table.avatarIconName} is null
			) or (
				${table.avatarType} = 'emoji'
				and ${table.avatarAssetId} is null
				and ${table.avatarEmoji} is not null
				and char_length(${table.avatarEmoji}) <= 64
				and ${table.avatarIconPrefix} is null
				and ${table.avatarIconName} is null
			) or (
				${table.avatarType} = 'icon'
				and ${table.avatarAssetId} is null
				and ${table.avatarEmoji} is null
				and ${table.avatarIconPrefix} in (${sql.join(
					FontAwesomeIconPrefixValues.map((prefix) => sql`${prefix}`),
					sql`, `,
				)})
				and ${table.avatarIconName} ~ ${FontAwesomeIconNamePatternSource}
				and char_length(${table.avatarIconName}) <= 128
			)`,
		),
		check(
			"unit_localization_value_check",
			sql`${table.avatarType} is not null or ${table.bannerAssetId} is not null or ${table.coverAssetId} is not null or ${table.title} is not null or ${table.summary} is not null or ${table.description} is not null or ${table.content} is not null`,
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
		index("image_asset_cleanup_idx")
			.on(table.status, table.createdAt, table.id)
			.where(sql`${table.deletedAt} is null`),
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
		width: integer(),
		height: integer(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		unique("image_object_asset_id_key").on(table.assetId),
		unique("image_object_storage_key_key").on(table.storageKey),
		check("image_object_storage_key_not_blank", sql`btrim(${table.storageKey}) <> ''`),
		check(
			"image_object_metadata_shape_check",
			sql`(
				${table.mediaType} is null
				and ${table.byteSize} is null
				and ${table.width} is null
				and ${table.height} is null
			) or (
				${table.mediaType} is not null
				and ${table.byteSize} > 0
				and ${table.width} > 0
				and ${table.height} > 0
			)`,
		),
	],
);

/**
 * Reusable rendering intent owned by one ImageAsset.
 *
 * Crop coordinates are normalized against the auto-oriented original. They
 * remain provider-neutral and are converted to pixel trim at delivery time.
 */
export const imageAssetPresentation = pgTable(
	"image_asset_presentation",
	{
		assetId: uuid()
			.notNull()
			.references(() => imageAsset.id, { onDelete: "cascade" }),
		role: imageAssetPresentationRole().notNull(),
		fit: imageAssetPresentationFit().notNull(),
		cropX: doublePrecision(),
		cropY: doublePrecision(),
		cropWidth: doublePrecision(),
		cropHeight: doublePrecision(),
		revision: integer().default(1).notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.assetId, table.role] }),
		check(
			"image_asset_presentation_shape_check",
			sql`(
				${table.role} = 'cover'::image_asset_presentation_role
				and ${table.fit} = 'contain'::image_asset_presentation_fit
				and ${table.cropX} is null
				and ${table.cropY} is null
				and ${table.cropWidth} is null
				and ${table.cropHeight} is null
			) or (
				${table.fit} = 'crop'::image_asset_presentation_fit
				and ${table.cropX} is not null
				and ${table.cropY} is not null
				and ${table.cropWidth} is not null
				and ${table.cropHeight} is not null
			)`,
		),
		check(
			"image_asset_presentation_crop_bounds_check",
			sql`${table.fit} <> 'crop'::image_asset_presentation_fit or (
				${table.cropX} >= 0
				and ${table.cropY} >= 0
				and ${table.cropWidth} > 0
				and ${table.cropHeight} > 0
				and ${table.cropX} + ${table.cropWidth} <= 1
				and ${table.cropY} + ${table.cropHeight} <= 1
			)`,
		),
		check("image_asset_presentation_revision_check", sql`${table.revision} > 0`),
	],
);

/**
 * A Profile's one-way interest relation to a Unit and the source of truth for
 * follow state. Every readable Unit kind can be a follow target.
 *
 * This relation does not enable notification delivery channels or define which
 * activities are surfaced to followers. Downstream consumers define those
 * behaviors independently.
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
