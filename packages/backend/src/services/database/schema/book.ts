import {
  boolean,
  index,
  integer,
  pgTable,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createdAt, jsonData, nullableTimestamp, updatedAt } from "./columns.ts";
import { Unit } from "./unit.ts";

export const Book = pgTable(
  "Book",
  {
    unitId: uuid()
      .primaryKey()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    isbn13: varchar({ length: 32 }),
    publicationDate: nullableTimestamp(),
    pageCount: integer(),
    textLength: integer().default(0).notNull(),
    formatKey: varchar({ length: 32 }),
    isLicensed: boolean().default(false).notNull(),
    extra: jsonData(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    chapterCount: integer().default(0).notNull(),
  },
  (table) => [
    index("Book_isbn13_idx").using("btree", table.isbn13.asc().nullsLast()),
    index("Book_publicationDate_idx").using(
      "btree",
      table.publicationDate.asc().nullsLast(),
    ),
  ],
);
