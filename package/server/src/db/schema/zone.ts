import { index, integer, pgTable, uuid, varchar } from "drizzle-orm/pg-core";
import { createdAt, jsonData, nullableTimestamp, updatedAt } from "./columns";
import { Unit } from "./unit";

export const Zone = pgTable(
  "Zone",
  {
    unitId: uuid()
      .primaryKey()
      .references(() => Unit.id, { onDelete: "cascade", onUpdate: "cascade" }),
    ownerRealmUnitId: uuid()
      .notNull()
      .references(() => Unit.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    filters: jsonData().notNull(),
    configVersion: integer().notNull().default(1),
    pages: jsonData(),
    sections: jsonData(),
    theme: jsonData(),
    primaryRealmUnitId: uuid().references(() => Unit.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    template: varchar({ length: 64 }).notNull(),
    styling: jsonData(),
    startsAt: nullableTimestamp(),
    endsAt: nullableTimestamp(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    wiki: jsonData(),
  },
  (table) => [
    index("Zone_ownerRealmUnitId_idx").using(
      "btree",
      table.ownerRealmUnitId.asc().nullsLast(),
    ),
    index("Zone_primaryRealmUnitId_idx").using(
      "btree",
      table.primaryRealmUnitId.asc().nullsLast(),
    ),
  ],
);
