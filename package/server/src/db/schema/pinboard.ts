import { index, pgTable, unique, uuid, varchar } from "drizzle-orm/pg-core";
import { createdAt, updatedAt, uuidv7PrimaryKey } from "./columns";
import { Realm } from "./realm";
import { Unit } from "./unit";

export const Pinboard = pgTable(
  "Pinboard",
  {
    id: uuidv7PrimaryKey(),
    realmUnitId: uuid()
      .notNull()
      .references(() => Realm.unitId, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    placement: varchar({ length: 64 }).notNull(),
    // Pinboard kind is a render mode. V1 is fixed to `list`; purpose lives in `placement`.
    kind: varchar({ length: 32 }).default("list").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    unique("Pinboard_realmUnitId_placement_unique").on(
      table.realmUnitId,
      table.placement,
    ),
    index("Pinboard_realmUnitId_idx").using(
      "btree",
      table.realmUnitId.asc().nullsLast(),
    ),
  ],
);

export const PinboardEntry = pgTable(
  "PinboardEntry",
  {
    id: uuidv7PrimaryKey(),
    pinboardId: uuid()
      .notNull()
      .references(() => Pinboard.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    unitId: uuid()
      .notNull()
      .references(() => Unit.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    position: varchar({ length: 64 }).notNull().default("V"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    unique("PinboardEntry_pinboardId_unitId_unique").on(
      table.pinboardId,
      table.unitId,
    ),
    index("PinboardEntry_pinboardId_position_unitId_idx").using(
      "btree",
      table.pinboardId.asc().nullsLast(),
      table.position.asc().nullsLast(),
      table.unitId.asc().nullsLast(),
    ),
  ],
);
