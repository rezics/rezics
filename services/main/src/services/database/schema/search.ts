import { sql } from "drizzle-orm";
import { bigint, check, index, jsonb, text, uuid } from "drizzle-orm/pg-core";
import type { SharedSearchQueryDocument } from "@rezics/filter";

import { pgTable } from "./base";
import { createCreatedAtColumn, createUuidv7PrimaryKey } from "./columns";
import { CanonicalPgroongaIndexes } from "./pgroonga";
import { profile } from "./profile";
import { unit } from "./unit";

const UnitSearchTextColumnNames = [
	"text_all",
	"text_zh",
	"text_en",
	"text_ja",
	"text_ko",
	"text_de",
	"text_fr",
	"text_es",
	"search_order_key",
] as const;

const UnitSearchDocumentLargeOptions = {
	lexicon_flags_mapping: `'${JSON.stringify(
		Object.fromEntries(UnitSearchTextColumnNames.map((name) => [name, ["LARGE"]])),
	)}'`,
	index_flags_mapping: `'${JSON.stringify(
		Object.fromEntries(UnitSearchTextColumnNames.map((name) => [name, ["LARGE"]])),
	)}'`,
} as const;

/** One current full-text document and stable Search order key per immutable Unit identity. */
export const unitSearchDocument = pgTable(
	"unit_search_document",
	{
		unitId: uuid()
			.primaryKey()
			.references(() => unit.id, { onDelete: "cascade" }),
		unitUpdatedAtMicros: bigint({ mode: "bigint" }).notNull(),
		searchOrderKey: text().notNull(),
		textAll: text(),
		textZh: text(),
		textEn: text(),
		textJa: text(),
		textKo: text(),
		textDe: text(),
		textFr: text(),
		textEs: text(),
	},
	(table) => [
		index(CanonicalPgroongaIndexes[3])
			.using(
				"pgroonga",
				table.textAll,
				table.textZh,
				table.textEn,
				table.textJa,
				table.textKo,
				table.textDe,
				table.textFr,
				table.textEs,
				table.searchOrderKey.op("public.pgroonga_text_term_search_ops_v2"),
			)
			.with(UnitSearchDocumentLargeOptions),
	],
);

/**
 * Immutable public Search query snapshots.
 *
 * The UUIDv7 primary key is the bearer identifier used by share links. Stored
 * presentation metadata is never trusted for execution; the API revalidates
 * the Search Feature state before insert and after read.
 */
export const sharedSearchQuery = pgTable(
	"shared_search_query",
	{
		id: createUuidv7PrimaryKey(),
		document: jsonb().$type<SharedSearchQueryDocument>().notNull(),
		createdByProfileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "restrict" }),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		check(
			"shared_search_query_document_check",
			sql`jsonb_typeof(${table.document}) = 'object'`,
		),
	],
);
