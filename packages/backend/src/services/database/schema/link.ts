import { pgTable, text, uuid, varchar } from "drizzle-orm/pg-core";
import { createdAt, jsonData, updatedAt } from "./columns.ts";
import { Unit } from "./unit.ts";

export const Link = pgTable("Link", {
  unitId: uuid()
    .primaryKey()
    .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
  url: text().notNull(),
  siteName: varchar({ length: 128 }),
  faviconUrl: text(),
  extra: jsonData(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});
