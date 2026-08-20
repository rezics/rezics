import type { ContentLanguageSupport } from "@rezics/content-language";
import { MaximumContentLanguageSupportEntries } from "@rezics/content-language";
import { inArray, sql } from "drizzle-orm";
import { check, foreignKey, jsonb, text, uuid } from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import { createUpdatedAtColumn } from "./columns";
import {
	type ContentLanguageSupportUnitKind,
	ContentLanguageSupportUnitKindValues,
} from "./contract-values";
import { unit } from "./unit";

/**
 * Sparse, authoritative content-consumption language support for one Unit.
 *
 * An absent row represents the empty array. The bounded JSON document keeps
 * the user-edited field atomic for history and conditional writes; runtime
 * contract parsing supplies the canonical BCP 47 and per-channel proof.
 */
export const unitContentLanguageSupport = pgTable(
	"unit_content_language_support",
	{
		unitId: uuid().primaryKey(),
		unitKind: text().$type<ContentLanguageSupportUnitKind>().notNull(),
		value: jsonb().$type<ContentLanguageSupport>().notNull(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		foreignKey({
			columns: [table.unitId, table.unitKind],
			foreignColumns: [unit.id, unit.kind],
			name: "unit_content_language_support_unit_kind_fkey",
		}).onDelete("cascade"),
		check(
			"unit_content_language_support_kind_check",
			inArray(table.unitKind, ContentLanguageSupportUnitKindValues),
		),
		check(
			"unit_content_language_support_value_check",
			sql`jsonb_typeof(${table.value}) = 'array'
				and jsonb_array_length(${table.value}) between 1 and ${MaximumContentLanguageSupportEntries}`,
		),
	],
);
