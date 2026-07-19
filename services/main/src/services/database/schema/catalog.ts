import { sql } from "drizzle-orm";
import {
	check,
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
import { AliasKindValues, toEnumValues } from "./contract-values";
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
		language: text(),
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
			.on(table.unitId, sql`coalesce(${table.language}, '')`, table.normalizedTerm)
			.where(sql`${table.deletedAt} is null`),
		index("unit_alias_normalized_idx").on(table.normalizedTerm),
		index("unit_alias_term_search_idx")
			.using("pgroonga", table.term)
			.where(sql`${table.deletedAt} is null`),
		index("unit_alias_created_by_idx").on(table.createdByProfileId),
		check(
			"unit_alias_term_not_blank",
			sql`btrim(${table.term}) <> '' and btrim(${table.normalizedTerm}) <> ''`,
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
		role: text().default("related").notNull(),
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
		check("unit_link_role_not_blank", sql`btrim(${table.role}) <> ''`),
	],
);

export const unitVariant = pgTable(
	"unit_variant",
	{
		unitId: uuid()
			.primaryKey()
			.references(() => unit.id, { onDelete: "cascade" }),
		canonicalUnitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "restrict" }),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		index("unit_variant_canonical_idx").on(table.canonicalUnitId),
		check("unit_variant_not_self_check", sql`${table.unitId} <> ${table.canonicalUnitId}`),
	],
);
