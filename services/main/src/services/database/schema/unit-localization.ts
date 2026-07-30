import {
	AvatarTypeValues,
	FontAwesomeIconNamePatternSource,
	FontAwesomeIconPrefixValues,
	type AvatarType,
	type FontAwesomeIconPrefix,
} from "@rezics/avatar";
import { inArray, sql } from "drizzle-orm";
import {
	type AnyPgColumn,
	check,
	index,
	pgEnum,
	primaryKey,
	text,
	unique,
	uuid,
} from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import {
	type ContentLanguage,
	ContentLanguageValues,
	ContentStatusValues,
	toEnumValues,
} from "./contract-values";
import {
	createCreatedAtColumn,
	createJsonDocumentColumn,
	createUpdatedAtColumn,
	fractionalIndexPosition,
} from "./columns";
import { imageAsset } from "./image";
import { unit } from "./unit";

export const contentStatus = pgEnum("content_status", toEnumValues(ContentStatusValues));

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
