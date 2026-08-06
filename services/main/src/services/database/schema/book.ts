import { inArray, sql } from "drizzle-orm";
import { check, date, index, integer, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";

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
		isbn13: text(),
		publicationDate: date(),
		pageCount: integer(),
		/** Authoritative editorial metadata used by the Book Search template. */
		wordCount: integer(),
		format: text(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		uniqueIndex("book_isbn13_key").on(table.isbn13).where(sql`${table.isbn13} is not null`),
		index("book_publication_date_idx").on(table.publicationDate),
		check("book_isbn13_check", sql`${table.isbn13} is null or ${table.isbn13} ~ '^[0-9]{13}$'`),
		check("book_page_count_check", sql`${table.pageCount} is null or ${table.pageCount} > 0`),
		check("book_word_count_check", sql`${table.wordCount} is null or ${table.wordCount} >= 0`),
		check("book_release_status_check", inArray(table.releaseStatus, WorkReleaseStatusValues)),
	],
);
