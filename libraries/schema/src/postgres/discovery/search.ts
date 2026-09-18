import { unitReferenceColumns, unitReferenceConstraints } from "../shared/unit-reference-columns";
import type { SharedSearchQueryDocument } from "@rezics/filter";
import { inArray, sql } from "drizzle-orm";
import { bigint, check, index, jsonb, text, uuid } from "drizzle-orm/pg-core";

import { pgTable } from "../shared/base";
import { entityIdentity } from "../catalog/identity";
import { createCreatedAtColumn, createUuidv7PrimaryKey } from "../shared/columns";
import { UnitOwnerValues, type UnitOwner } from "@rezics/reference";
import { CanonicalPgroongaIndexes } from "../shared/pgroonga";

const UnitSearchTextColumnNames = [
	"unit_owner",
	"unit_shape",
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
		unitId: uuid().primaryKey(),
		unitOwner: text().$type<UnitOwner>().notNull(),
		unitShape: text().notNull(),
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

		...unitReferenceColumns("unit", "cascade"),
	},
	(table) => [
		...unitReferenceConstraints("unit_search_document", "unit", table, false, table.unitId),
		check("unit_search_document_owner_check", inArray(table.unitOwner, UnitOwnerValues)),

		index(CanonicalPgroongaIndexes[3])
			.using(
				"pgroonga",
				table.unitOwner.op("public.pgroonga_text_term_search_ops_v2"),
				table.unitShape.op("public.pgroonga_text_term_search_ops_v2"),
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
			.references(() => entityIdentity.id, { onDelete: "restrict" }),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		check("shared_search_query_document_check", sql`jsonb_typeof(${table.document}) = 'object'`),
	],
);
