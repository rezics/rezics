import { sql } from "drizzle-orm";
import { boolean, check, date, index, integer, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import { createCreatedAtColumn, createUpdatedAtColumn } from "./columns";
import { unit } from "./core";

export const book = pgTable(
	"book",
	{
		id: uuid()
			.primaryKey()
			.references(() => unit.id, { onDelete: "cascade" }),
		isbn13: text(),
		publicationDate: date(),
		pageCount: integer(),
		format: text(),
		licensed: boolean().default(false).notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		uniqueIndex("book_isbn13_key")
			.on(table.isbn13)
			.where(sql`${table.isbn13} is not null`),
		index("book_publication_date_idx").on(table.publicationDate),
		check("book_isbn13_check", sql`${table.isbn13} is null or ${table.isbn13} ~ '^[0-9]{13}$'`),
		check("book_page_count_check", sql`${table.pageCount} is null or ${table.pageCount} > 0`),
	],
);
