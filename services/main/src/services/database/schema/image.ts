import { sql } from "drizzle-orm";
import {
	bigint,
	check,
	doublePrecision,
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
	ImageAssetAccessValues,
	ImageAssetPresentationFitValues,
	ImageAssetPresentationRoleValues,
	ImageAssetStatusValues,
	toEnumValues,
} from "./contract-values";
import {
	createCreatedAtColumn,
	createTimestampMsColumn,
	createUpdatedAtColumn,
	createUuidv7PrimaryKey,
} from "./columns";
import { profile } from "./profile";

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
				and ${table.byteSize} is not null
				and ${table.byteSize} > 0
				and ${table.width} is not null
				and ${table.width} > 0
				and ${table.height} is not null
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
