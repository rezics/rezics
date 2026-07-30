import { inArray, sql } from "drizzle-orm";
import { check, foreignKey, integer, primaryKey, text, uuid } from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import { createCreatedAtColumn, createUpdatedAtColumn } from "./columns";
import { type ContentLanguage, ContentLanguageValues } from "./contract-values";
import { unitLocalization } from "./unit-localization";

/**
 * Rebuildable current-state projection for localized Portable Text.
 *
 * Metrics deliberately remain outside Unit revision documents. A restore writes
 * semantic localization state first and then rebuilds this projection with the
 * current algorithm.
 */
export const unitLocalizationContentMetric = pgTable(
	"unit_localization_content_metric",
	{
		unitId: uuid().notNull(),
		language: text().$type<ContentLanguage>().notNull(),
		wordCount: integer().notNull(),
		characterCount: integer().notNull(),
		algorithmVersion: integer().notNull(),
		sourceSha256: text().notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.unitId, table.language] }),
		foreignKey({
			columns: [table.unitId, table.language],
			foreignColumns: [unitLocalization.unitId, unitLocalization.language],
			name: "unit_localization_content_metric_localization_fkey",
		}).onDelete("cascade"),
		check(
			"unit_localization_content_metric_language_check",
			inArray(table.language, ContentLanguageValues),
		),
		check("unit_localization_content_metric_word_count_check", sql`${table.wordCount} >= 0`),
		check(
			"unit_localization_content_metric_character_count_check",
			sql`${table.characterCount} >= 0`,
		),
		check(
			"unit_localization_content_metric_algorithm_version_check",
			sql`${table.algorithmVersion} > 0`,
		),
		check(
			"unit_localization_content_metric_source_sha256_check",
			sql`${table.sourceSha256} ~ '^[0-9a-f]{64}$'`,
		),
	],
);
