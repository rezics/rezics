import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createdAt, jsonData, updatedAt } from "./columns.ts";
import { User } from "./identity.ts";
import { Unit } from "./unit.ts";

/**
 * General user-curated shelves. Series is a separate first-class model.
 * 通用的用户自建书架。Series 是独立的一等模型。
 */
export const Shelf = pgTable("Shelf", {
  unitId: uuid()
    .primaryKey()
    .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
  extra: jsonData(),
  rootItemCount: integer().default(0).notNull(),
  itemCount: integer().default(0).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const ShelfItem = pgTable(
  "ShelfItem",
  {
    shelfId: uuid()
      .notNull()
      .references(() => Shelf.unitId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    itemType: varchar({ length: 32 }).default("unit").notNull(),
    itemId: uuid("itemId").notNull(),
    kind: varchar({ length: 32 }).notNull(),
    parentItemType: varchar({ length: 32 }),
    parentItemId: uuid("parentItemId"),
    parentRole: varchar({ length: 32 }),
    position: varchar({ length: 64 }).notNull(), // Fractional Indexing
    /**
     * User-authored indexing help only.
     * 仅供用户自填的索引辅助信息。
     */
    searchText: text(),
    createdByUserId: uuid().references(() => User.unitId, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    primaryKey({
      columns: [table.shelfId, table.itemType, table.itemId],
      name: "ShelfItem_pkey",
    }),
    foreignKey({
      columns: [table.shelfId, table.parentItemType, table.parentItemId],
      foreignColumns: [table.shelfId, table.itemType, table.itemId],
      name: "ShelfItem_parent_fkey",
    })
      .onUpdate("cascade")
      .onDelete("set null"),
    index("ShelfItem_shelfId_parent_position_idx").using(
      "btree",
      table.shelfId.asc().nullsLast(),
      table.parentItemType.asc().nullsLast(),
      table.parentItemId.asc().nullsLast(),
      table.position.asc().nullsLast(),
    ),
    index("ShelfItem_shelfId_position_idx").using(
      "btree",
      table.shelfId.asc().nullsLast(),
      table.position.asc().nullsLast(),
    ),
    index("ShelfItem_item_idx").using(
      "btree",
      table.itemType.asc().nullsLast(),
      table.itemId.asc().nullsLast(),
    ),
    check(
      "ShelfItem_not_self_parent",
      table.parentItemId
        ? sql`${table.parentItemId} is null or ${table.parentItemId} <> ${table.itemId} or ${table.parentItemType} <> ${table.itemType}`
        : sql`true`,
    ),
  ],
);
