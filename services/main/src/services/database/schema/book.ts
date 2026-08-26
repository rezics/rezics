import { inArray, sql } from "drizzle-orm";
import { boolean, check, date, index, integer, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import { createCreatedAtColumn, createUpdatedAtColumn } from "./columns";
import { WorkReleaseStatusValues } from "./contract-values";
import { unit } from "./unit";

export const book = pgTable(
	"book",
	{
		id: uuid()
			.primaryKey()
			.references(() => unit.id, { onDelete: "cascade" }),
		releaseStatus: text({ enum: WorkReleaseStatusValues }).notNull(),
		/** Describes that REZICS should expose metadata, but not hosted work content. */
		metadataOnly: boolean("metadata_only").default(true).notNull(),
		isbn13: text(),
		publicationDate: date(),
		pageCount: integer(),
		/** Authoritative editorial metadata available to Book Zone filtering. */
		wordCount: integer(),
		/**
		 * Legacy free-text Book format retained for Search compatibility and migration analysis.
		 *
		 * @remarks
		 * Unit CRUD APIs must neither accept nor expose this value. Its replacement is a
		 * deterministic relation to Tag identities, independent of Tag voting.
		 *
		 * @todo Decide whether Book format records `tagId` or `tagIds`, then define validation,
		 * migration, and Search cutover before removing this column.
		 */
		format: text(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		uniqueIndex("book_isbn13_key").on(table.isbn13).where(sql`${table.isbn13} is not null`),
		index("book_release_status_id_idx").on(table.releaseStatus, table.id),
		index("book_publication_date_idx").on(table.publicationDate),
		check("book_isbn13_check", sql`${table.isbn13} is null or ${table.isbn13} ~ '^[0-9]{13}$'`),
		check("book_page_count_check", sql`${table.pageCount} is null or ${table.pageCount} > 0`),
		check("book_word_count_check", sql`${table.wordCount} is null or ${table.wordCount} >= 0`),
		check("book_release_status_check", inArray(table.releaseStatus, WorkReleaseStatusValues)),
	],
);
