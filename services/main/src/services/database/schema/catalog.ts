import { inArray, sql } from "drizzle-orm";
import {
	check,
	foreignKey,
	index,
	integer,
	pgEnum,
	primaryKey,
	text,
	unique,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import {
	AliasKindValues,
	type ContentLanguage,
	ContentLanguageValues,
	toEnumValues,
	type VariantCapableUnitKind,
	VariantCapableUnitKindValues,
} from "./contract-values";
import {
	createCreatedAtColumn,
	createTimestampMsColumn,
	createUpdatedAtColumn,
	createUuidv7PrimaryKey,
	fractionalIndexPosition,
} from "./columns";
import { profile, unit } from "./core";
import { entity } from "./entity";

export const aliasKind = pgEnum("alias_kind", toEnumValues(AliasKindValues));

/**
 * Marks a Catalog Unit whose content Rezics may host under the same platform
 * content terms used for ordinary Posts. The Unit's public reuse License remains
 * independently described by unit.license.
 */
export const catalogUnitContentLicense = pgTable(
	"catalog_unit_content_license",
	{
		unitId: uuid().primaryKey(),
		unitKind: text().$type<VariantCapableUnitKind>().notNull(),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		foreignKey({
			columns: [table.unitId, table.unitKind],
			foreignColumns: [unit.id, unit.kind],
			name: "catalog_unit_content_license_unit_kind_fkey",
		}).onDelete("cascade"),
		check(
			"catalog_unit_content_license_kind_check",
			inArray(table.unitKind, VariantCapableUnitKindValues),
		),
	],
);

export const unitAlias = pgTable(
	"unit_alias",
	{
		id: createUuidv7PrimaryKey(),
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		/** @UNIT_LOCALIZATION_EXEMPT Search synonym: language-tagged lookup term, never canonical Unit display copy. */
		term: text().notNull(),
		normalizedTerm: text().notNull(),
		language: text().$type<ContentLanguage>(),
		kind: aliasKind().default("common").notNull(),
		createdByProfileId: uuid().references(() => profile.id, {
			onDelete: "set null",
		}),
		deletedAt: createTimestampMsColumn(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		uniqueIndex("unit_alias_unit_language_normalized_key")
			.on(table.unitId, table.language, table.normalizedTerm)
			.where(sql`${table.deletedAt} is null and ${table.language} is not null`),
		uniqueIndex("unit_alias_unit_unscoped_normalized_key")
			.on(table.unitId, table.normalizedTerm)
			.where(sql`${table.deletedAt} is null and ${table.language} is null`),
		index("unit_alias_normalized_idx").on(table.normalizedTerm),
		index("unit_alias_created_by_idx").on(table.createdByProfileId),
		check(
			"unit_alias_term_not_blank",
			sql`btrim(${table.term}) <> '' and btrim(${table.normalizedTerm}) <> ''`,
		),
		check(
			"unit_alias_language_check",
			sql`${table.language} is null or ${inArray(table.language, ContentLanguageValues)}`,
		),
		check(
			"unit_alias_deleted_at_check",
			sql`${table.deletedAt} is null or ${table.deletedAt} >= ${table.createdAt}`,
		),
	],
);

export const unitAliasVote = pgTable(
	"unit_alias_vote",
	{
		aliasId: uuid()
			.notNull()
			.references(() => unitAlias.id, { onDelete: "cascade" }),
		profileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "cascade" }),
		value: integer().notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.aliasId, table.profileId] }),
		index("unit_alias_vote_profile_idx").on(table.profileId),
		check("unit_alias_vote_value_check", sql`${table.value} in (-1, 1)`),
	],
);

export const unitLink = pgTable(
	"unit_link",
	{
		id: createUuidv7PrimaryKey(),
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		sourceEntityId: uuid()
			.notNull()
			.references(() => entity.id, { onDelete: "restrict" }),
		url: text().notNull(),
		normalizedUrl: text().notNull(),
		normalizedUrlHash: text().notNull(),
		position: fractionalIndexPosition()
			.default(sql`'a0'::text`)
			.notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		unique("unit_link_unit_source_hash_key").on(
			table.unitId,
			table.sourceEntityId,
			table.normalizedUrlHash,
		),
		index("unit_link_unit_position_idx").on(table.unitId, table.position, table.id),
		index("unit_link_source_entity_idx").on(table.sourceEntityId),
		check(
			"unit_link_url_check",
			sql`${table.url} ~ '^https?://' and ${table.normalizedUrl} ~ '^https?://'`,
		),
		check("unit_link_hash_check", sql`${table.normalizedUrlHash} ~ '^[0-9a-f]{64}$'`),
	],
);

export const unitVariant = pgTable(
	"unit_variant",
	{
		variantUnitId: uuid().primaryKey(),
		mainUnitId: uuid().notNull(),
		unitKind: text().$type<VariantCapableUnitKind>().notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		foreignKey({
			columns: [table.variantUnitId, table.unitKind],
			foreignColumns: [unit.id, unit.kind],
			name: "unit_variant_variant_kind_fkey",
		}).onDelete("cascade"),
		foreignKey({
			columns: [table.mainUnitId, table.unitKind],
			foreignColumns: [unit.id, unit.kind],
			name: "unit_variant_main_kind_fkey",
		}).onDelete("restrict"),
		index("unit_variant_main_created_at_idx").on(
			table.mainUnitId,
			table.createdAt,
			table.variantUnitId,
		),
		check("unit_variant_kind_check", inArray(table.unitKind, VariantCapableUnitKindValues)),
		check("unit_variant_not_self_check", sql`${table.variantUnitId} <> ${table.mainUnitId}`),
	],
);
