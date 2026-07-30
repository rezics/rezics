import { inArray, sql } from "drizzle-orm";
import {
	check,
	index,
	integer,
	pgEnum,
	primaryKey,
	text,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import {
	AliasKindValues,
	type ContentLanguage,
	ContentLanguageValues,
	toEnumValues,
} from "./contract-values";
import {
	createCreatedAtColumn,
	createTimestampMsColumn,
	createUpdatedAtColumn,
	createUuidv7PrimaryKey,
} from "./columns";
import { profile } from "./profile";
import { unit } from "./unit";

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
