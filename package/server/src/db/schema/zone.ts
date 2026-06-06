import { boolean, pgTable, uuid, varchar } from "drizzle-orm/pg-core";
import { createdAt, jsonData, nullableTimestamp, updatedAt } from "./columns";
import { Unit } from "./unit";

export const Zone = pgTable("Zone", {
  unitId: uuid()
    .primaryKey()
    .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
  filters: jsonData().notNull(),
  template: varchar({ length: 64 }).notNull(),
  styling: jsonData(),
  startsAt: nullableTimestamp(),
  endsAt: nullableTimestamp(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  wiki: jsonData(),
});
